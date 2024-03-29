import Atom from "../core/nodes/atom";
import Graph from "../core/graph";
import { getObservable, getObservableSource, getAction } from "./utils/lookup";
import { notifyUpdate, notifyAdd, notifyDelete } from "./utils/observe";
import { isPropertyKey, getPropertyDescriptor } from "../utils";
import Administration from "./utils/Administration";
import AtomMap from "./utils/AtomMap";
import ComputedNode from "../core/nodes/computed";
import { runInAction } from "../index";
import {
	ComputedOptions,
	Configuration,
	ConfigurationGetter,
	ConfigurationTypes,
	defaultConfigGetter,
	ObservableOptions,
	ObservableOptionsConfig,
	propertyType,
} from "./utils/configuration";

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
			this.proxyTraps.construct = (_, args) =>
				this.proxyConstruct(args) as object;
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
		return this.graph.batch(() =>
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

	private proxyOwnKeys(): (string | symbol)[] {
		this.keysAtom.reportObserved();
		return Reflect.ownKeys(this.source);
	}

	private get(key: PropertyKey): T[keyof T] {
		return Reflect.get(this.source, key, this.proxy);
	}

	private set(key: PropertyKey, value: T[keyof T]): void {
		this.graph.batch(() => {
			Reflect.set(this.source, key, value, this.proxy);
		});
	}

	private loadConfig(key: PropertyKey): void {
		if (
			this.configGetter &&
			!Object.prototype.hasOwnProperty.call(this.config, key)
		) {
			this.config[key] = this.configGetter(key as keyof T, this.proxy);
		}
	}

	private isUnconfigured(key: PropertyKey): boolean {
		this.loadConfig(key);
		return (
			!Object.prototype.hasOwnProperty.call(this.config, key) ||
			this.config[key] === undefined
		);
	}

	private getConfig(key: PropertyKey): ConfigurationTypes {
		this.loadConfig(key);
		return (this.config?.[key] ?? propertyType.observable)!;
	}

	private getComputed(key: PropertyKey): ComputedNode<T[keyof T]> {
		const computedConfig: ConfigurationTypes = (this.config?.[key] ??
			propertyType.observable) as ComputedOptions;
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
				computedConfig.equals,
				computedConfig.keepAlive,
				this.proxy
			);

			this.computedMap.set(key, computedNode);
		}

		return computedNode;
	}

	onObservedStateChange(
		callback: (observing: boolean) => void,
		key: PropertyKey | undefined
	): () => void {
		if (key == null) {
			return this.graph.onObservedStateChange(this.atom, callback);
		}

		if (this.isUnconfigured(key)) {
			throw new Error(
				`onObservedStatChange not supported on this object with key: ${String(
					key
				)}`
			);
		}

		const config: ConfigurationTypes = (this.config?.[key] ??
			propertyType.observable)!;

		switch (config.type) {
			case propertyType.action.type: {
				throw new Error(`onObservedStatChange not supported on actions`);
			}
			case propertyType.observable.type: {
				const atom = this.valuesMap.getOrCreate(key);
				return this.graph.onObservedStateChange(atom, callback);
			}
			case propertyType.computed.type: {
				const computed = this.getComputed(key);
				return this.graph.onObservedStateChange(computed, callback);
			}
		}
	}

	read(key: PropertyKey): unknown {
		if (this.isUnconfigured(key)) {
			return this.get(key);
		}

		const config: ConfigurationTypes = this.getConfig(key);

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
						(config as unknown as ObservableOptionsConfig).configuration
					);
				}

				return getAction(
					this.get(key) as unknown as Function,
					this.graph,
					config,
					this.proxy
				);
			}
			case propertyType.computed.type: {
				const computedNode = this.getComputed(key);

				return computedNode.get();
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
		const config = this.getConfig(key);

		const had = key in this.source;
		const oldValue: T[keyof T] = this.get(key);
		const targetValue = getObservableSource(newValue);

		if (!had || oldValue !== targetValue) {
			if (config.type === propertyType.observable.type) {
				this.set(key, targetValue);
			} else {
				runInAction(() => this.set(key, targetValue));
			}

			this.graph.batch(() => {
				if (!had) {
					this.keysAtom.reportChanged();
					this.hasMap.reportChanged(key);
					notifyAdd(this.proxy, targetValue, key);
				} else {
					notifyUpdate(this.proxy, targetValue, oldValue, key);
				}

				this.valuesMap.reportChanged(key);
				this.flushChange();
			});
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
		this.graph.batch(() => {
			this.valuesMap.reportChanged(key);
			this.keysAtom.reportChanged();
			this.hasMap.reportChanged(key);

			this.valuesMap.delete(key);
			this.flushChange();
			notifyDelete(this.proxy, oldValue, key);
		});
	}
}
