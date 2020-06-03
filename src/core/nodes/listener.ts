import Graph, { Listener, ObservableNode, nodeTypes } from "../graph";

export default class ListenerNode implements Listener {
	readonly nodeType = nodeTypes.listener;
	readonly observing: Set<ObservableNode> = new Set();

	constructor(readonly graph: Graph, private readonly callback: () => void) {}

	dispose(): void {
		this.graph.remove(this);
	}

	react(): void {
		this.callback.call(null);
	}

	track<T>(trackFn: () => T): T {
		return this.graph.runObserver(this, trackFn);
	}
}
