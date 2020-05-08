import Graph, { Listener, ObservableNode, nodeTypes } from "../graph";

export default class ListenerNode<T> implements Listener {
	readonly nodeType = nodeTypes.listener;
	readonly observing: Set<ObservableNode> = new Set();

	constructor(
		private readonly graph: Graph,
		private readonly callback: () => void
	) {}

	dispose(): void {
		this.graph.remove(this);
	}

	react(): void {
		this.callback.call(null);
	}

	track(trackFn: () => T | void): T | void {
		return this.graph.runObserver(this, trackFn);
	}
}
