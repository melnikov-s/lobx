import Graph, {
	Computed,
	ObservableNode,
	ObserverNode,
	nodeTypes,
} from "../graph";
import { defaultEquals } from "../../utils";

export default class ComputedNode<T> implements Computed<T> {
	readonly nodeType = nodeTypes.computed;
	private dirty = true;
	private isComputing = false;
	readonly observers: Set<ObserverNode> = new Set();
	readonly observing: Set<ObservableNode> = new Set();
	value: T | null = null;

	constructor(
		readonly graph: Graph,
		private readonly derive: () => T,
		private readonly comparator: (a: T, b: T) => boolean = defaultEquals,
		private keepAlive: boolean = false,
		private readonly context?: unknown
	) {}

	// clear out any cached value and force the dirty flag
	clear(): void {
		this.dirty = true;
		this.value = null;
	}

	equals(value: T): boolean {
		if (this.isDirty()) {
			this.get();
		}

		return this.comparator(value, this.value as T);
	}

	// computed is dirty and needs to be re-derived if it's internal state is dirty
	// or if it's marked as potentially stale by the graph. A computed becomes potentially
	// stale when one of its dependents has changed.
	isDirty(): boolean {
		return this.dirty || this.graph.isPotentiallyStale(this);
	}

	isKeepAlive(): boolean {
		return this.keepAlive;
	}

	get(): T {
		if (this.isComputing) {
			throw new Error("cycle detected in computed method");
		}

		this.graph.reportObserved(this);

		if (this.isDirty()) {
			let value;

			this.isComputing = true;
			this.dirty = false;

			try {
				this.value = value = this.graph.runObserver(
					this,
					this.derive,
					this.context
				);
			} catch (e) {
				this.dirty = true;
				throw e;
			} finally {
				this.isComputing = false;
			}

			return value;
		}

		return this.value as T;
	}

	setKeepAlive(keepAlive: boolean): void {
		const wasKeepAlive = this.keepAlive;
		this.keepAlive = keepAlive;
		if (wasKeepAlive && !keepAlive && !this.graph.isObserved(this)) {
			this.graph.remove(this);
		}
	}
}
