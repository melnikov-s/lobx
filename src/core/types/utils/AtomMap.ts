import Atom from "../../nodes/atom";
import Graph from "../../graph";
import { isNonPrimitive } from "../../../utils";

export default class AtomMap<K> {
	private map: Map<unknown, Atom> | undefined;
	private weakMap: WeakMap<object, Atom> | undefined;
	private graph: Graph;

	constructor(graph: Graph) {
		this.graph = graph;
	}

	get(key: unknown): Atom | undefined {
		return isNonPrimitive(key) ? this.weakMap?.get(key) : this.map?.get(key);
	}

	delete(key: K): void {
		isNonPrimitive(key) ? this.weakMap?.delete(key) : this.map?.delete(key);
	}

	getOrCreate(key: K): Atom {
		let entry: Atom | undefined = this.get(key);

		if (!entry) {
			if (isNonPrimitive(key)) {
				this.weakMap = this.weakMap ?? new WeakMap();

				entry = new Atom(this.graph);

				this.weakMap.set(key, entry);
			} else {
				this.map = this.map ?? new Map();

				entry = new Atom(this.graph);
				this.graph.onBecomeUnobserved(entry, () => {
					this.map?.delete(key);
				});

				this.map.set(key, entry);
			}
		}

		return entry;
	}

	reportObserved(key: K): void {
		this.getOrCreate(key).reportObserved();
	}

	reportChanged(key: K): void {
		return this.get(key)?.reportChanged();
	}
}
