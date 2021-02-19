import Graph from "../core/graph";
import Atom from "../core/nodes/atom";
import {
	getObservable,
	getObservableSource,
	getAdministration,
} from "./utils/lookup";
import { notifyAdd, notifyDelete } from "./utils/trace";
import Administration, {
	getAdministration as hasObservable,
} from "./utils/Administration";
import AtomMap from "./utils/AtomMap";

export class SetAdministration<T>
	extends Administration<Set<T>>
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

	private hasEntry(value: T): boolean {
		return !!(
			this.source.has(getObservableSource(value)) ||
			(hasObservable(value) &&
				this.source.has(getObservable(value, this.graph)))
		);
	}

	clear(): void {
		this.graph.batch(() => {
			this.source.forEach((value) => this.delete(value));
		});
	}

	forEach(
		callbackFn: (value: T, value2: T, set: Set<T>) => void,
		thisArg?: unknown
	): void {
		this.keysAtom.reportObserved();
		this.atom.reportObserved();
		this.source.forEach((value) => {
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
		if (!this.hasEntry(value)) {
			const target = getObservableSource(value);
			this.source.add(target);
			this.graph.batch(() => {
				this.keysAtom.reportChanged();
				this.hasMap.reportChanged(target);
			});

			notifyAdd(this.proxy, target);
		}

		return this;
	}

	delete(value: T): boolean {
		if (this.hasEntry(value)) {
			const target = getObservableSource(value);
			this.source.delete(target);
			this.source.delete(value);
			this.graph.batch(() => {
				this.keysAtom.reportChanged();
				this.hasMap.reportChanged(target);
			});

			notifyDelete(this.proxy, target);

			return true;
		}
		return false;
	}

	has(value: T): boolean {
		if (this.graph.isTracking()) {
			const target = getObservableSource(value);
			this.hasMap.reportObserved(target);
			this.atom.reportObserved();
		}

		return this.hasEntry(value);
	}

	entries(): IterableIterator<[T, T]> {
		let nextIndex = 0;
		const values = Array.from(this.values());
		return {
			[Symbol.iterator]: function (): IterableIterator<[T, T]> {
				return this;
			},
			next(): IteratorResult<[T, T]> {
				const index = nextIndex;
				nextIndex += 1;
				return index < values.length
					? { value: [values[index], values[index]], done: false }
					: { done: true, value: undefined };
			},
		};
	}

	keys(): IterableIterator<T> {
		return this.values();
	}

	values(): IterableIterator<T> {
		this.keysAtom.reportObserved();
		this.atom.reportObserved();

		let nextIndex = 0;
		const observableValues = Array.from(this.source.values()).map((o) =>
			getObservable(o, this.graph)
		);
		return {
			[Symbol.iterator]: function (): IterableIterator<T> {
				return this;
			},
			next(): IteratorResult<T> {
				return nextIndex < observableValues.length
					? {
							value: observableValues[nextIndex++],
							done: false,
					  }
					: { done: true, value: undefined };
			},
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
	Symbol.iterator,
].forEach((method) => {
	setMethods[method] = function (): unknown {
		const adm = getAdministration(this);
		return adm[method].apply(adm, arguments);
	};
});
