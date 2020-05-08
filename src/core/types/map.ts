import Atom from "../nodes/atom";
import Graph from "../graph";

import { AtomMap, getObservable, getObservableSource } from "./utils";
import { notifyUpdate, notifyAdd, notifyDelete } from "../trace";

class ObservableValueMap<K, V> {
	private _map: Map<K, V>;
	private _atomMap: AtomMap<K>;

	constructor(map: Map<K, V>, graph: Graph) {
		this._map = map;
		this._atomMap = new AtomMap(graph);
	}

	get(key: K): V | undefined {
		if (this._map.has(key)) {
			this._atomMap.reportObserved(key);
		}

		return this._map.get(key);
	}

	peek(key: K): V | undefined {
		return this._map.get(key);
	}

	has(key: K): boolean {
		return this._map.has(key);
	}

	set(key: K, value: V): void {
		if (!this._map.has(key) || this._map.get(key) !== value) {
			this._map.set(key, value);
			this._atomMap.reportChanged(key);
		}
	}

	delete(key: K): void {
		if (this._map.has(key)) {
			this._map.delete(key);
			this._atomMap.reportChanged(key);
			this._atomMap.delete(key);
		}
	}

	keys(): IterableIterator<K> {
		return this._map.keys();
	}

	forEach(callback: (value: V, key: K, object: Map<K, V>) => void): void {
		this._map.forEach(callback);
	}

	get size(): number {
		return this._map.size;
	}
}

export class ObservableMap<K, V> implements Map<K, V> {
	private _data: ObservableValueMap<K, V>;
	private _hasMap: AtomMap<K>;
	private _keysAtom: Atom;
	private _graph: Graph;
	[Symbol.iterator](): IterableIterator<[K, V]> {
		return this.entries();
	}
	[Symbol.toStringTag]: "Map" = "Map";

	constructor(map: Map<K, V> = new Map(), graph: Graph) {
		this._data = new ObservableValueMap(map, graph);
		this._hasMap = new AtomMap(graph);
		this._keysAtom = new Atom(graph);
		this._graph = graph;
	}

	has(key: K): boolean {
		const targetKey = getObservableSource(key);

		if (this._graph.isTracking()) {
			this._hasMap.reportObserved(targetKey);
		}

		return this._data.has(targetKey);
	}

	set(key: K, value: V): this {
		const targetKey = getObservableSource(key);
		const targetValue = getObservableSource(value);

		const hasKey = this._data.has(targetKey);
		let oldValue: V | undefined;

		if (!hasKey || (oldValue = this._data.peek(targetKey)) !== targetValue) {
			this._graph.runAction(() => {
				this._data.set(targetKey, targetValue);
				if (!hasKey) {
					this._hasMap.reportChanged(targetKey);
					this._keysAtom.reportChanged();
				}
			});

			hasKey
				? notifyUpdate(this, targetValue, oldValue, targetKey)
				: notifyAdd(this, targetValue, targetKey);
		}

		return this;
	}

	delete(key: K): boolean {
		const targetKey = getObservableSource(key);

		if (this._data.has(targetKey)) {
			const oldValue = this._data.peek(targetKey);

			this._graph.runAction(() => {
				this._keysAtom.reportChanged();
				this._hasMap.reportChanged(targetKey);
				this._data.delete(targetKey);
			});

			notifyDelete(this, oldValue, targetKey);
			return true;
		}
		return false;
	}

	get(key: K): V | undefined {
		const targetKey = getObservableSource(key);
		return this.has(targetKey)
			? getObservable(this._data.get(targetKey), this._graph)
			: undefined;
	}

	keys(): IterableIterator<K> {
		this._keysAtom.reportObserved();

		let nextIndex = 0;
		const observableKeys = Array.from(this._data.keys()).map(o =>
			getObservable(o, this._graph)
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
		this._keysAtom.reportObserved();
		this._data.forEach((_, key) =>
			callback.call(thisArg, this.get(key)!, key, this)
		);
	}

	clear(): void {
		this._graph.runAction(() => {
			this._data.forEach((_, key) => this.delete(key));
		});
	}

	get size(): number {
		this._keysAtom.reportObserved();
		return this._data.size;
	}
}
