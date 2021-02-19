import Atom from "../../core/nodes/atom";
import Graph from "../../core/graph";
import { isNonPrimitive } from "../../utils";

export default class AtomMap<K> {
	private map: Map<unknown, Atom> | undefined;
	private weakMap: WeakMap<object, Atom> | undefined;
	private graph: Graph;
	private readonly clearOnUnobserved: boolean;

	constructor(graph: Graph, clearOnUnobserved: boolean = false) {
		this.graph = graph;
		this.clearOnUnobserved = clearOnUnobserved;
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
				if (this.clearOnUnobserved) {
					const unsub = this.graph.onObservedStateChange(entry, (observing) => {
						if (!observing) {
							this.map?.delete(key);
							unsub();
						}
					});
				}

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
