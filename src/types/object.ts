import Atom from "../core/nodes/atom";
import Graph from "../core/graph";
import { getObservable, getObservableSource, getAction } from "./utils/lookup";
import { notifyUpdate, notifyAdd, notifyDelete } from "./utils/trace";
import { isPropertyKey, getPropertyDescriptor } from "../utils";
import Administration from "./utils/Administration";
import AtomMap from "./utils/AtomMap";
import ComputedNode from "../core/nodes/computed";

type ConfigurationTypes =
	| ObservableOptions
	| ComputedOptions
	| ActionOptions
	| undefined;

export type ConfigurationGetter<T> = (
	name: keyof T,
	object: T
) => ConfigurationTypes;

export type Configuration<T> = Partial<Record<keyof T, ConfigurationTypes>>;

type Types = "observable" | "computed" | "action";

type ObservableOptions = {
	type: "observable";
	ref: boolean;
};

type ObservableOptionsConfig = ObservableOptions & {
	configuration: Configuration<unknown>;
};

type ComputedOptions = { type: "computed"; ref: boolean };
type ActionOptions = { type: "action" };

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
	action: ActionOptions;
};

const defaultObservable: ObservableOptions = {
	type: "observable",
	ref: false
};
const defaultComputed: ComputedOptions = { type: "computed", ref: true };
const actionType: ActionOptions = { type: "action" };

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

export const propertyType: {
	[key in Types]: PropertyOptions[key];
} = {
	observable: observableType,
	computed: computedType,
	action: actionType
} as const;

function defaultConfigGetter(
	key: PropertyKey,
	proxy: object
): ConfigurationTypes {
	const descriptor = getPropertyDescriptor(proxy, key);
	if (descriptor && typeof descriptor.get === "function") {
		return propertyType.computed;
	}

	return propertyType.observable;
}

export class ObjectAdministration<T extends object> extends Administration<T> {
	keysAtom: Atom;
	hasMap: AtomMap<PropertyKey>;
	valuesMap: AtomMap<PropertyKey>;
	computedMap!: Map<PropertyKey, ComputedNode<T[keyof T]>>;
	config: Configuration<T>;
	configGetter: ConfigurationGetter<T> | undefined;

	constructor(
		source: T = {} as T,
		graph: Graph,
		config: Configuration<T> | ConfigurationGetter<T> = defaultConfigGetter
	) {
		super(source, graph);
		this.keysAtom = new Atom(graph);
		this.hasMap = new AtomMap(graph, true);
		this.valuesMap = new AtomMap(graph);
		if (typeof config === "function") {
			this.config = {};
			this.configGetter = config;
		} else {
			this.config = config;
		}
		if (typeof source === "function") {
			this.proxyTraps.construct = (_, args) => this.proxyConstruct(args);
			this.proxyTraps.apply = (_, thisArg, args) =>
				this.proxyApply(thisArg, args);
		}

		this.proxyTraps.get = (_, name) => this.proxyGet(name);
		this.proxyTraps.set = (_, name, value) => this.proxySet(name, value);
		this.proxyTraps.has = (_, name) => this.proxyHas(name);
		this.proxyTraps.deleteProperty = (_, name) =>
			this.proxyDeleteProperty(name);
		this.proxyTraps.ownKeys = () => this.proxyOwnKeys();
	}

	private proxyConstruct(
		args: unknown[]
	): T extends new (args: unknown[]) => unknown ? InstanceType<T> : never {
		const instance = Reflect.construct(this.source as Function, args);

		return getObservable(instance, this.graph);
	}

	private proxyApply(
		thisArg: unknown,
		args: unknown[]
	): T extends (args: unknown[]) => unknown ? ReturnType<T> : never {
		return this.graph.transaction(() =>
			Reflect.apply(this.source as Function, thisArg, args)
		);
	}

	private proxyHas(name: PropertyKey): boolean {
		if (!(name in Object.prototype) && isPropertyKey(name))
			return this.has(name);
		return Reflect.has(this.source, name);
	}

	private proxyGet(name: PropertyKey): unknown {
		if (
			!(name in Object.prototype) &&
			isPropertyKey(name) &&
			(typeof this.source !== "function" || name !== "prototype")
		) {
			return this.read(name);
		}

		return Reflect.get(this.source, name, this.proxy);
	}

	private proxySet(name: PropertyKey, value: T[keyof T]): boolean {
		if (!isPropertyKey(name)) return false;

		this.write(name, value);

		return true;
	}

	private proxyDeleteProperty(name: PropertyKey): boolean {
		if (!isPropertyKey(name)) return false;
		this.remove(name);
		return true;
	}

	private proxyOwnKeys(): (string | number | symbol)[] {
		this.keysAtom.reportObserved();
		return Reflect.ownKeys(this.source);
	}

	private get(key: PropertyKey): T[keyof T] {
		return Reflect.get(this.source, key, this.proxy);
	}

	private set(key: PropertyKey, value: T[keyof T]): void {
		this.graph.transaction(() => {
			Reflect.set(this.source, key, value, this.proxy);
		});
	}

	private isUnconfigured(key: PropertyKey): boolean {
		if (
			this.configGetter &&
			!Object.prototype.hasOwnProperty.call(this.config, key)
		) {
			this.config[key] = this.configGetter(key as keyof T, this.proxy);
		}

		return (
			!Object.prototype.hasOwnProperty.call(this.config, key) ||
			this.config[key] === undefined
		);
	}

	read(key: PropertyKey): unknown {
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

				return getAction((this.get(key) as unknown) as Function, this.graph);
			}
			case propertyType.computed.type: {
				if (!this.computedMap) this.computedMap = new Map();
				let computedNode = this.computedMap.get(key);
				if (!computedNode) {
					const descriptor = getPropertyDescriptor(this.source, key)!;
					if (typeof descriptor?.get !== "function") {
						throw new Error("computed values are only supported on getters");
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
				throw new Error(`unknown type passed to configure`);
		}
	}

	write(key: PropertyKey, newValue: T[keyof T]): void {
		if (this.isUnconfigured(key)) {
			this.set(key, newValue);
			return;
		}

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

	remove(key: PropertyKey): void {
		if (!(key in this.source) || this.isUnconfigured(key)) return;

		const oldValue = this.get(key);
		delete this.source[key];
		this.graph.transaction(() => {
			this.valuesMap.reportChanged(key);
			this.keysAtom.reportChanged();
			this.hasMap.reportChanged(key);

			this.valuesMap.delete(key);
			this.flushChange();
		});

		notifyDelete(this.proxy, oldValue, key);
	}
}
