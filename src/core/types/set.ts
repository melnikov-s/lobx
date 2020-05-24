import Graph from "../graph";
import Atom from "../nodes/atom";
import {
	getObservable,
	getObservableSource,
	getAdministration
} from "./utils/lookup";
import { notifyAdd, notifyDelete } from "../trace";
import Administration from "./utils/Administration";
import AtomMap from "./utils/AtomMap";

export class SetAdministration<T> extends Administration<Set<T>>
	implements Set<T> {
	hasMap: AtomMap<T>;
	keysAtom: Atom;

	constructor(source: Set<T> = new Set(), graph: Graph) {
		super(source, graph);
		this.hasMap = new AtomMap(graph, true);
		this.keysAtom = new Atom(graph);
		this.proxyTraps.get = (_, name) => this.proxyGet(name);
	}

	private proxyGet(name: string | number | symbol): unknown {
		if (name === "size" && "size" in this.source) {
			return this.size;
		}

		const val = this.source[name];

		if (setMethods.hasOwnProperty(name) && typeof val === "function") {
			return setMethods[name];
		}

		return val;
	}

	clear(): void {
		this.graph.transaction(() => {
			this.source.forEach(value => this.delete(value));
		});
	}

	forEach(
		callbackFn: (value: T, value2: T, set: Set<T>) => void,
		thisArg?: unknown
	): void {
		this.keysAtom.reportObserved();
		this.atom.reportObserved();
		this.source.forEach(value => {
			const observed = getObservable(value, this.graph);
			callbackFn.call(thisArg, observed, observed, this);
		});
	}

	get size(): number {
		this.keysAtom.reportObserved();
		this.atom.reportObserved();
		return this.source.size;
	}

	add(value: T): this {
		const target = getObservableSource(value);

		if (!this.source.has(target)) {
			this.source.add(target);
			this.graph.transaction(() => {
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
			this.graph.transaction(() => {
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
			this.atom.reportObserved();
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
		this.atom.reportObserved();

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
