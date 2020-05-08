import Atom from "../nodes/atom";
import Graph from "../graph";

import {
	AtomMap,
	getObservable,
	getObservableSource,
	getAdministration,
	linkAdministration,
	Administration
} from "./types";
import { notifyUpdate, notifyAdd, notifyDelete } from "../trace";

class ObservableValueMap<K, V> {
	map: Map<K, V>;
	atomMap: AtomMap<K>;

	constructor(map: Map<K, V>, graph: Graph) {
		this.map = map;
		this.atomMap = new AtomMap(graph);
	}

	get(key: K): V | undefined {
		if (this.map.has(key)) {
			this.atomMap.reportObserved(key);
		}

		return this.map.get(key);
	}

	peek(key: K): V | undefined {
		return this.map.get(key);
	}

	has(key: K): boolean {
		return this.map.has(key);
	}

	set(key: K, value: V): void {
		if (!this.map.has(key) || this.map.get(key) !== value) {
			this.map.set(key, value);
			this.atomMap.reportChanged(key);
		}
	}

	delete(key: K): void {
		if (this.map.has(key)) {
			this.map.delete(key);
			this.atomMap.reportChanged(key);
			this.atomMap.delete(key);
		}
	}

	keys(): IterableIterator<K> {
		return this.map.keys();
	}

	forEach(callback: (value: V, key: K, object: Map<K, V>) => void): void {
		this.map.forEach(callback);
	}

	get size(): number {
		return this.map.size;
	}
}

export class ObservableMapAdministration<K, V>
	implements Map<K, V>, Administration<Map<K, V>> {
	data: ObservableValueMap<K, V>;
	hasMap: AtomMap<K>;
	keysAtom: Atom;
	graph: Graph;
	proxy: Map<K, V>;

	constructor(source: Map<K, V> = new Map(), graph: Graph) {
		this.data = new ObservableValueMap(source, graph);
		this.hasMap = new AtomMap(graph);
		this.keysAtom = new Atom(graph);
		this.graph = graph;
		this.proxy = new Proxy(this.source, mapProxyTraps) as Map<K, V>;
		linkAdministration(this.proxy, this);
	}

	get source(): Map<K, V> {
		return this.data.map;
	}

	has(key: K): boolean {
		const targetKey = getObservableSource(key);

		if (this.graph.isTracking()) {
			this.hasMap.reportObserved(targetKey);
		}

		return this.data.has(targetKey);
	}

	set(key: K, value: V): this {
		const targetKey = getObservableSource(key);
		const targetValue = getObservableSource(value);

		const hasKey = this.data.has(targetKey);
		let oldValue: V | undefined;

		if (!hasKey || (oldValue = this.data.peek(targetKey)) !== targetValue) {
			this.graph.runAction(() => {
				this.data.set(targetKey, targetValue);
				if (!hasKey) {
					this.hasMap.reportChanged(targetKey);
					this.keysAtom.reportChanged();
				}
			});

			hasKey
				? notifyUpdate(this.proxy, targetValue, oldValue, targetKey)
				: notifyAdd(this.proxy, targetValue, targetKey);
		}

		return this;
	}

	delete(key: K): boolean {
		const targetKey = getObservableSource(key);

		if (this.data.has(targetKey)) {
			const oldValue = this.data.peek(targetKey);

			this.graph.runAction(() => {
				this.keysAtom.reportChanged();
				this.hasMap.reportChanged(targetKey);
				this.data.delete(targetKey);
			});

			notifyDelete(this.proxy, oldValue, targetKey);
			return true;
		}
		return false;
	}

	get(key: K): V | undefined {
		const targetKey = getObservableSource(key);
		return this.has(targetKey)
			? getObservable(this.data.get(targetKey), this.graph)
			: undefined;
	}

	keys(): IterableIterator<K> {
		this.keysAtom.reportObserved();

		let nextIndex = 0;
		const observableKeys = Array.from(this.data.keys()).map(o =>
			getObservable(o, this.graph)
		);
		return {
			[Symbol.iterator]: function(): IterableIterator<K> {
				return this;
			},
			next(): IteratorResult<K> {
				return nextIndex < observableKeys.length
					? {
							value: observableKeys[nextIndex++],
							done: false
					  }
					: { done: true, value: undefined };
			}
		};
	}

	values(): IterableIterator<V> {
		const self = this;
		const keys = this.keys();
		return {
			[Symbol.iterator]: function(): IterableIterator<V> {
				return this;
			},
			next(): IteratorResult<V> {
				const { done, value } = keys.next();
				return {
					done,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					value: done ? (undefined as any) : self.get(value)
				};
			}
		};
	}

	entries(): IterableIterator<[K, V]> {
		const self = this;
		const keys = this.keys();
		return {
			[Symbol.iterator]: function(): IterableIterator<[K, V]> {
				return this;
			},
			next(): IteratorResult<[K, V]> {
				const { done, value } = keys.next();
				return {
					done,
					value: done
						? // eslint-disable-next-line @typescript-eslint/no-explicit-any
						  (undefined as any)
						: ([value, self.get(value)!] as [K, V])
				};
			}
		};
	}

	forEach(
		callback: (value: V, key: K, object: Map<K, V>) => void,
		thisArg?: unknown
	): void {
		this.keysAtom.reportObserved();
		this.data.forEach((_, key) =>
			callback.call(thisArg, this.get(key)!, key, this)
		);
	}

	clear(): void {
		this.graph.runAction(() => {
			this.data.forEach((_, key) => this.delete(key));
		});
	}

	get size(): number {
		this.keysAtom.reportObserved();
		return this.data.size;
	}

	[Symbol.iterator](): IterableIterator<[K, V]> {
		return this.entries();
	}

	[Symbol.toStringTag]: "Map" = "Map";
}

const mapProxyTraps: ProxyHandler<Map<unknown, unknown>> = {
	get<K, V>(
		target: Map<K, V>,
		name: string | number | symbol,
		proxy: Map<K, V>
	) {
		const adm = getAdministration(proxy);

		if (name === "size") {
			return adm.size;
		}

		if (mapMethods.hasOwnProperty(name)) {
			return mapMethods[name];
		}

		return target[name];
	}
};

const mapMethods = {};

[
	"clear",
	"forEach",
	"has",
	"get",
	"set",
	"delete",
	"entries",
	"keys",
	"values",
	Symbol.iterator
].forEach(method => {
	mapMethods[method] = function(): unknown {
		const adm = getAdministration(this);
		return adm[method].apply(adm, arguments);
	};
});
