import Atom from "../nodes/atom";
import Graph from "../graph";
import {
	getAdministration,
	getObservable,
	getObservableSource,
	getAction,
	getObservableWithConfig
} from "./utils/lookup";
import { notifyUpdate, notifyAdd, notifyDelete } from "../trace";
import { isPropertyKey, getPropertyDescriptor } from "../../utils";
import Administration from "./utils/Administration";
import AtomMap from "./utils/AtomMap";
import ComputedNode from "../nodes/computed";

export type Configuration<T> = Partial<
	Record<keyof T, ObservableOptions | ComputedOptions | ActionOptions>
>;

type Types = "observable" | "computed" | "action";

type ObservableOptions = {
	type: "observable";
	ref: boolean;
};

type ObservableOptionsConfig = ObservableOptions & {
	configuration: Configuration<unknown>;
};

type ComputedOptions = { type: "computed"; ref: boolean };
type ActionOptions = { type: "action"; async: boolean };

type ConfigOption<
	T extends ObservableOptions | ComputedOptions | ActionOptions
> = Partial<Omit<T, "type">>;

type CallableOption<
	T extends ObservableOptions | ComputedOptions | ActionOptions
> = T &
	(T extends ObservableOptions
		? { configure: <S>(c: Configuration<S>) => T }
		: {}) &
	((options: ConfigOption<T>) => T);

type PropertyOptions = {
	observable: CallableOption<ObservableOptions>;
	computed: CallableOption<ComputedOptions>;
	action: CallableOption<ActionOptions>;
};

const defaultObservable: ObservableOptions = {
	type: "observable",
	ref: false
};
const defaultComputed: ComputedOptions = { type: "computed", ref: false };
const defaultAction: ActionOptions = { type: "action", async: false };

const observableType: CallableOption<ObservableOptions> = Object.assign(
	function(options: ConfigOption<ObservableOptions>): ObservableOptions {
		return {
			...defaultObservable,
			...options,
			type: "observable"
		};
	},
	defaultObservable,
	{
		configure: <T>(c: Configuration<T>): ObservableOptions => {
			return {
				type: "observable",
				configuration: c,
				ref: false
			} as ObservableOptions;
		}
	}
);

const computedType: CallableOption<ComputedOptions> = Object.assign(function(
	options: ConfigOption<ComputedOptions>
): ComputedOptions {
	return { ...defaultComputed, ...options, type: "computed" };
},
defaultComputed);

const actionType: CallableOption<ActionOptions> = Object.assign(function(
	options: ConfigOption<ActionOptions>
): ActionOptions {
	return { ...defaultAction, ...options, type: "action" };
},
defaultAction);

export const propertyType: {
	[key in Types]: PropertyOptions[key];
} = {
	observable: observableType,
	computed: computedType,
	action: actionType
} as const;

export class ObjectAdministration<T extends object> extends Administration<T> {
	keysAtom: Atom;
	hasMap: AtomMap<PropertyKey>;
	valuesMap: AtomMap<PropertyKey>;
	computedMap!: Map<PropertyKey, ComputedNode<T[keyof T]>>;
	config: Configuration<T> | undefined;
	instanceConfig: Configuration<T> | undefined;

	constructor(source: T = {} as T, graph: Graph, config?: Configuration<T>) {
		super(source, graph, objectProxyTraps);
		this.keysAtom = new Atom(graph);
		this.hasMap = new AtomMap(graph);
		this.valuesMap = new AtomMap(graph);
		if (typeof source === "function") {
			this.instanceConfig = config;
		} else {
			this.config = config;
		}
	}

	private get(key: keyof T): T[keyof T] {
		return Reflect.get(this.source, key, this.proxy);
	}

	private set(key: keyof T, value: T[keyof T]): void {
		this.graph.transaction(() => {
			Reflect.set(this.source, key, value, this.proxy);
		});
	}

	private isUnconfigured(key: PropertyKey): boolean {
		return !!(
			this.config && !Object.prototype.hasOwnProperty.call(this.config, key)
		);
	}

	read(key: keyof T): unknown {
		if (this.isUnconfigured(key)) {
			return this.get(key);
		}

		const config = this.config?.[key] ?? propertyType.observable;

		switch (config.type) {
			case propertyType.observable.type:
			case propertyType.action.type: {
				if (key in this.source) {
					this.valuesMap.reportObserved(key);
				} else if (this.graph.isTracking()) {
					this.hasMap.reportObserved(key);
				}

				this.atom.reportObserved();

				if (config.type === propertyType.observable.type) {
					if ((config as ObservableOptions).ref) {
						return this.get(key);
					}

					return getObservable(
						this.get(key),
						this.graph,
						((config as unknown) as ObservableOptionsConfig).configuration
					);
				}

				return getAction(
					(this.get(key) as unknown) as Function,
					this.graph,
					(config as ActionOptions).async
				);
			}
			case propertyType.computed.type: {
				if (!this.computedMap) this.computedMap = new Map();
				let computedNode = this.computedMap.get(key);
				if (!computedNode) {
					const descriptor = getPropertyDescriptor(this.source, key)!;
					if (typeof descriptor?.get !== "function") {
						throw new Error(
							"lobx computed values are only supported on getters"
						);
					}
					computedNode = new ComputedNode(
						this.graph,
						descriptor.get,
						undefined,
						false,
						this.proxy
					);

					this.computedMap.set(key, computedNode);
				}

				return (config as ComputedOptions).ref
					? computedNode.get()
					: getObservable(computedNode.get(), this.graph);
			}
			default:
				throw new Error(`lobx: unknown type passed to configure`);
		}
	}

	write(key: keyof T, newValue: T[keyof T]): void {
		const had = key in this.source;
		const oldValue: T[keyof T] = this.get(key);
		const targetValue = getObservableSource(newValue);

		if (!had || oldValue !== targetValue) {
			this.set(key, targetValue);

			this.graph.transaction(() => {
				if (!had) {
					this.keysAtom.reportChanged();
					this.hasMap.reportChanged(key);
				}

				this.valuesMap.reportChanged(key);
				this.flushChange();
			});

			had
				? notifyUpdate(this.proxy, targetValue, oldValue, key)
				: notifyAdd(this.proxy, targetValue, key);
		}
	}

	has(key: PropertyKey): boolean {
		if (this.graph.isTracking() && !this.isUnconfigured(key)) {
			this.hasMap.reportObserved(key);
			this.atom.reportObserved();
		}

		return key in this.source;
	}

	remove(key: keyof T): void {
		if (!(key in this.source)) return;

		const oldValue = this.get(key);
		delete this.source[key];
		this.graph.transaction(() => {
			this.valuesMap.reportChanged(key);
			this.keysAtom.reportChanged();
			this.valuesMap.delete(key);
			this.hasMap.reportChanged(key);
			this.flushChange();
		});

		notifyDelete(this.proxy, oldValue, key);
	}

	getKeys(): PropertyKey[] {
		this.keysAtom.reportObserved();
		return Object.keys(this.source);
	}
}

const objectProxyTraps: ProxyHandler<object> = {
	construct(target: Function, args: unknown[]) {
		const adm = getAdministration(target);

		const instance = Reflect.construct(target, args);

		return adm.instanceConfig
			? getObservableWithConfig(adm.instanceConfig, instance, adm.graph)
			: getObservable(instance, adm.graph);
	},
	apply(target: Function, thisArg: unknown, args: unknown[]) {
		const adm = getAdministration(target);

		return adm.graph.transaction(() => Reflect.apply(target, thisArg, args));
	},
	has<T extends object>(target: T, name: PropertyKey) {
		if (name === "constructor") return true;
		const adm = getAdministration(target);

		if (isPropertyKey(name)) return adm.has(name);
		return name in target;
	},
	get<T extends object>(target: T, name: keyof T) {
		if (name === "constructor") return target[name];
		const adm = getAdministration(target);

		if (isPropertyKey(name)) {
			return adm.read(name);
		}

		return Reflect.get(target, name, adm.proxy);
	},
	set<T extends object>(target: T, name: keyof T, value: T[keyof T]) {
		if (!isPropertyKey(name)) return false;

		const adm = getAdministration(target);

		adm.write(name, value);

		return true;
	},
	deleteProperty<T extends object>(target: T, name: keyof T) {
		if (!isPropertyKey(name)) return false;
		const adm = getAdministration(target);
		adm.remove(name);
		return true;
	},
	ownKeys<T extends object>(target: T) {
		const adm = getAdministration(target);
		adm.keysAtom.reportObserved();
		return Reflect.ownKeys(target);
	},
	preventExtensions(): boolean {
		throw new Error(`Dynamic observable objects cannot be frozen`);
		return false;
	}
};
