import Graph from "../core/graph";
import { defaultEquals } from "../utils";
import Atom from "../core/nodes/atom";

export default class ObservableValue<T> {
	value: T;
	graph: Graph;
	atom: Atom<T>;
	comparator: typeof defaultEquals;

	constructor(
		value: T,
		graph: Graph,
		comparator: typeof defaultEquals = defaultEquals
	) {
		this.value = value;
		this.graph = graph;
		this.comparator = comparator;
		this.atom = new Atom(graph, this.equals.bind(this));
	}

	equals(value: T): boolean {
		return this.comparator(this.value, value);
	}

	get(): T {
		this.atom.reportObserved();

		return this.value;
	}

	set(newValue: T): T {
		if (this.value !== newValue) {
			// if no one is observing us and we can perform the write silently
			if (!this.graph.isObserved(this.atom)) {
				this.value = newValue;
			} else {
				const oldValue = this.value;
				this.value = newValue;
				this.atom.reportChanged(oldValue);
			}
		}

		return this.value;
	}
}
