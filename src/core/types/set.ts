import Graph from "../graph";
import Atom from "../nodes/atom";
import {
	AtomMap,
	getObservable,
	getObservableSource,
	getAdministration,
	linkAdministration,
	Administration
} from "./types";
import { notifyAdd, notifyDelete } from "../trace";

export class ObservableSetAdministration<T>
	implements Set<T>, Administration<Set<T>> {
	source: Set<T>;
	hasMap: AtomMap<T>;
	keysAtom: Atom;
	graph: Graph;
	proxy: Set<T>;

	constructor(source: Set<T> = new Set(), graph: Graph) {
		this.source = source;
		this.hasMap = new AtomMap(graph);
		this.keysAtom = new Atom(graph);
		this.graph = graph;
		this.proxy = new Proxy(this.source, setProxyTraps) as Set<T>;
		linkAdministration(this.proxy, this);
	}

	clear(): void {
		this.graph.runAction(() => {
			this.source.forEach(value => this.delete(value));
		});
	}

	forEach(
		callbackFn: (value: T, value2: T, set: Set<T>) => void,
		thisArg?: unknown
	): void {
		this.keysAtom.reportObserved();
		this.source.forEach(value => {
			const observed = getObservable(value, this.graph);
			callbackFn.call(thisArg, observed, observed, this);
		});
	}

	get size(): number {
		this.keysAtom.reportObserved();
		return this.source.size;
	}

	add(value: T): this {
		const target = getObservableSource(value);

		if (!this.source.has(target)) {
			this.source.add(target);
			this.graph.runAction(() => {
				this.keysAtom.reportChanged();
				this.hasMap.reportChanged(target);
			});

			notifyAdd(this.proxy, target);
		}

		return this;
	}

	delete(value: T): boolean {
		const target = getObservableSource(value);

		if (this.source.has(target)) {
			this.source.delete(target);
			this.graph.runAction(() => {
				this.keysAtom.reportChanged();
				this.hasMap.reportChanged(target);
			});

			notifyDelete(this.proxy, target);

			return true;
		}
		return false;
	}

	has(value: T): boolean {
		const target = getObservableSource(value);

		if (this.graph.isTracking()) {
			this.hasMap.reportObserved(target);
		}

		return this.source.has(target);
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
		this.keysAtom.reportObserved();

		let nextIndex = 0;
		const observableValues = Array.from(this.source.values()).map(o =>
			getObservable(o, this.graph)
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

const setProxyTraps: ProxyHandler<Set<unknown>> = {
	get<T>(target: Set<T>, name: string | number | symbol, proxy: Set<T>) {
		const adm = getAdministration(proxy);

		if (name === "size") {
			return adm.size;
		}

		if (setMethods.hasOwnProperty(name)) {
			return setMethods[name];
		}

		return target[name];
	}
};

const setMethods = {};

[
	"clear",
	"forEach",
	"has",
	"add",
	"delete",
	"entries",
	"keys",
	"values",
	Symbol.iterator
].forEach(method => {
	setMethods[method] = function(): unknown {
		const adm = getAdministration(this);
		return adm[method].apply(adm, arguments);
	};
});
