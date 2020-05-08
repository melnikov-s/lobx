import Graph, { ObservableValue, ObserverNode, nodeTypes } from "../graph";
import { defaultEquals } from "../../utils";

export default class ObservableNode<T> implements ObservableValue<T> {
	readonly nodeType = nodeTypes.observable;
	readonly observers: Set<ObserverNode> = new Set();

	constructor(
		private readonly graph: Graph,
		public value: T,
		public readonly comparator: typeof defaultEquals = defaultEquals,
		public readonly onBecomeObserved?: () => void,
		public readonly onBecomeUnobserved?: () => void
	) {}

	equals(value: T): boolean {
		return this.comparator(this.value, value);
	}

	get(): T {
		this.graph.reportObserved(this);

		return this.value;
	}

	set(newValue: T): T {
		if (this.value !== newValue) {
			// if no one is observing us and we can perform the write silently
			if (!this.graph.isObserved(this)) {
				this.value = newValue;
			} else {
				const oldValue = this.value;
				this.value = newValue;
				this.graph.reportChanged(this, oldValue);
			}
		}

		return this.value;
	}
}
