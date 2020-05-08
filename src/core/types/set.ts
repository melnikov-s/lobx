import Graph from "../graph";
import Atom from "../nodes/atom";
import { AtomMap, getObservable, getObservableSource } from "./utils";
import { notifyAdd, notifyDelete } from "../trace";

export class ObservableSet<T> implements Set<T> {
	private _data: Set<T>;
	private _hasMap: AtomMap<T>;
	private _atom: Atom;
	private _graph: Graph;

	constructor(set: Set<T> = new Set(), graph: Graph) {
		this._data = set;
		this._hasMap = new AtomMap(graph);
		this._atom = new Atom(graph);
		this._graph = graph;
	}

	clear(): void {
		this._graph.runAction(() => {
			this._data.forEach(value => this.delete(value));
		});
	}

	forEach(
		callbackFn: (value: T, value2: T, set: Set<T>) => void,
		thisArg?: unknown
	): void {
		this._atom.reportObserved();
		this._data.forEach(value => {
			const observed = getObservable(value, this._graph);
			callbackFn.call(thisArg, observed, observed, this);
		});
	}

	get size(): number {
		this._atom.reportObserved();
		return this._data.size;
	}

	add(value: T): this {
		const target = getObservableSource(value);

		if (!this._data.has(target)) {
			this._data.add(target);
			this._graph.runAction(() => {
				this._atom.reportChanged();
				this._hasMap.reportChanged(target);
			});

			notifyAdd(this, target);
		}

		return this;
	}

	delete(value: T): boolean {
		const target = getObservableSource(value);

		if (this._data.has(target)) {
			this._data.delete(target);
			this._graph.runAction(() => {
				this._atom.reportChanged();
				this._hasMap.reportChanged(target);
			});

			notifyDelete(this, target);

			return true;
		}
		return false;
	}

	has(value: T): boolean {
		const target = getObservableSource(value);

		if (this._graph.isTracking()) {
			this._hasMap.reportObserved(target);
		}

		return this._data.has(target);
	}

	entries(): IterableIterator<[T, T]> {
		let nextIndex = 0;
		const values = Array.from(this.values());
		return {
			[Symbol.iterator]: function(): IterableIterator<[T, T]> {
				return this;
			},
			next(): IteratorResult<[T, T]> {
				const index = nextIndex;
				nextIndex += 1;
				return index < values.length
					? { value: [values[index], values[index]], done: false }
					: { done: true, value: undefined };
			}
		};
	}

	keys(): IterableIterator<T> {
		return this.values();
	}

	values(): IterableIterator<T> {
		this._atom.reportObserved();

		let nextIndex = 0;
		const observableValues = Array.from(this._data.values()).map(o =>
			getObservable(o, this._graph)
		);
		return {
			[Symbol.iterator]: function(): IterableIterator<T> {
				return this;
			},
			next(): IteratorResult<T> {
				return nextIndex < observableValues.length
					? {
							value: observableValues[nextIndex++],
							done: false
					  }
					: { done: true, value: undefined };
			}
		};
	}

	[Symbol.iterator](): IterableIterator<T> {
		return this.values();
	}

	[Symbol.toStringTag]: "Set" = "Set";
}
