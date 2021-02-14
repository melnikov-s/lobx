import Graph, { Listener, ObservableNode, nodeTypes } from "../graph";

export default class ListenerNode implements Listener {
	readonly nodeType = nodeTypes.listener;
	readonly observing: Set<ObservableNode> = new Set();
	private disposed = false;

	constructor(
		readonly graph: Graph,
		readonly callback: (listener: ListenerNode) => void
	) {}

	get isDisposed(): boolean {
		return this.disposed;
	}

	dispose(): void {
		this.disposed = true;
		this.graph.remove(this);
	}

	react(): void {
		if (!this.disposed) {
			this.callback.call(null, this);
		}
	}

	track<T>(trackFn: () => T): T {
		return this.graph.runObserver(this, trackFn);
	}
}
