import Graph, { Atom, ObserverNode, nodeTypes } from "../graph";

export default class AtomNode<T = unknown> implements Atom<T> {
	readonly nodeType = nodeTypes.atom;
	readonly observers: Set<ObserverNode> = new Set();

	constructor(
		readonly graph: Graph,
		private readonly comparator?: (a: T) => boolean
	) {}

	reportChanged(value?: T): void {
		if (this.graph.isObserved(this)) {
			this.graph.reportChanged(this, value);
		}
	}

	reportObserved(): boolean {
		this.graph.reportObserved(this);

		return this.graph.isObserved(this);
	}

	equals(value: T): boolean {
		return this.comparator ? this.comparator(value) : false;
	}
}
