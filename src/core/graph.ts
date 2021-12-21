/*

Both observers and observables are nodes in a directed dependency graph. 
The connections between the nodes are made at runtime and start with
the listener node. As the listener node executes it makes a connection
with any computed and observable node that is read. Once the listener is done
with its execution then that path of the graph becomes completed.
When a change is made to an observer node it will traverse down the graph
invalidating that path until it reaches the listener. The listener will
then re-execute and recreates a new path.

Below is the general shape of the graph:

                 atoms occupy the top of the graph
                 and have no dependencies
 +------------+  +------------+  +-------------+
 |            |  |            |  |             |
 | atom       |  |  atom      |  |  atom       |
 |            |  |            |  |             |
 |            |  |            |  |             |
 +--+---+--+--+  +-----+------+  +-------+----++
    |   |  |           |                 |    |
==============================================================================
    |   |  |           |                 |    |
    |   |  +-------------------------+   |    |
    |   |              |             |   |    |
    |   |              |             |   |    +---------+
    |   +------+       |             |   |              |
    |        +---------+-+           |   |              |
    |        |           |         +-+---+-------+    +-+----------+
    |        | computed  |         |             |    |            |
    |        |           |         |  computed   |    |  computed  |
    |        |           |         |             |    |            |
    |        +--------+--+         |             |    |            |
    |                 |            +-------+---+-+    +-------+----+
    |                 |                    |   |              |
    |      computed nodes live in the middle of the graph and |
    |      can be n levels deep, having atoms
    |      and other computed nodes as their dependencies     |
    |                 +----------+---------+   |              |
    |                            |             |              |
    |                            |             |              |
    |                   +--------+---------+   |              |
    |                   |                  |   |              |
    |                   |    computed      |   |              |
    |                   |                  |   |              |
    +--------------+    |                  |   |              |
                   |    +----------+-------+   |              |
                   |               |           +------------+ |
==============================================================================
                   +-----------|   |                        | |
                             +-----+--------+             +-+-+---------+
                             |              |             |             |
                             |   listener   |             |   listener  |
                             |              |             |             |
                             |              |             |             |
                             +--------------+             +-------------+

                               listeners occupy the bottom of the graph
                               and have observers and computed nodes
                               as their dependencies but do not have any
                               dependents
*/

export const nodeTypes = {
	atom: 1,
	computed: 2,
	listener: 3,
} as const;

interface Observable {
	observers: Set<ObserverNode>;
	graph: Graph;
}

interface Observer {
	observing: Set<ObservableNode>;
	graph: Graph;
}

export interface Atom<T = unknown> extends Observable {
	nodeType: typeof nodeTypes.atom;
	equals(a: T): boolean;
}

export interface Computed<T = unknown> extends Observer, Observable {
	nodeType: typeof nodeTypes.computed;
	isKeepAlive(): boolean;
	clear(): void;
	value: T | null;
	equals(a: T): boolean;
}

export interface Listener extends Observer {
	nodeType: typeof nodeTypes.listener;
	react(): void;
}

export type ObserverNode = Computed | Listener;
export type ObservableNode = Computed | Atom;
export type Node = ObserverNode | ObservableNode;

export default class Graph {
	private changedObservables: Map<Node, unknown> = new Map();
	private inBatch = false;
	private actionsEnforced = false;
	private inAction = false;
	private invokedComputed: Set<Computed<unknown>> = new Set();
	private potentialUnObserved: Set<ObservableNode> = new Set();
	private potentialStale: Set<Computed<unknown>> = new Set();
	private queuedListeners: Set<Listener> = new Set();
	private runStack: (ObserverNode | null)[] = [];
	private onObservedStateChangeCallbacks: Map<
		ObservableNode,
		Set<(observing: boolean) => void>
	> = new Map();
	private reactionsCompleteCallbacks: Set<() => void> = new Set();
	private callDepth = 0;
	private taskDepth = 0;
	private taskCalledStack: boolean[] = [];

	// clean up any unobserved computed nodes that were cached for the
	// duration of a batch or derivation
	private clearInvokedComputed(): void {
		this.invokedComputed.forEach((c) => {
			if (c.observers.size === 0 && !c.isKeepAlive()) {
				this.remove(c);
			}
		});
		this.invokedComputed.clear();
	}

	// determine if a node has changed it's value during a batch
	private hasChanged(node: Node): boolean {
		let changed = false;

		switch (node.nodeType) {
			case nodeTypes.atom:
				changed =
					this.changedObservables.has(node) &&
					!node.equals(this.changedObservables.get(node));
				break;
			case nodeTypes.computed:
				if (!this.changedObservables.has(node)) {
					return false;
				}

				node.observing.forEach((o) => {
					changed = changed || this.hasChanged(o);
				});

				if (!changed) {
					this.potentialStale.delete(node);
				}

				changed = changed && !node.equals(this.changedObservables.get(node));
				break;
			case nodeTypes.listener:
				node.observing.forEach((o) => {
					changed = changed || this.hasChanged(o);
				});
				break;
		}

		return changed;
	}

	private notifyObservedState(
		observable: ObservableNode,
		observing: boolean
	): void {
		this.onObservedStateChangeCallbacks
			.get(observable)
			?.forEach((f) => f(observing));
	}

	// propagate a change to an observable down the graph during a batch
	// in order to mark any affected computed nodes as a potentially stale
	// and collect all dependent listeners
	private propagateChange(node: ObservableNode): void {
		node.observers.forEach((childNode) => {
			if (childNode.nodeType === nodeTypes.computed) {
				// if this is the first time this computed node was changed within
				// a batch we collect its value for later comparison
				// at this point the computed value should never be dirty
				if (!this.changedObservables.has(childNode)) {
					this.changedObservables.set(childNode, childNode.value);
				}

				// if a computed is already marked as stale we can stop propagation
				if (!this.potentialStale.has(childNode)) {
					this.potentialStale.add(childNode);
					this.propagateChange(childNode);
				}
			} else {
				// store all affected listeners for potential invocation when batch
				// is complete
				const listener = childNode as Listener;

				this.queuedListeners.delete(listener);
				this.queuedListeners.add(listener);
			}
		});
	}

	private get topOfRunStack(): ObserverNode | null {
		return this.runStack[this.runStack.length - 1] || null;
	}

	enforceActions(enforce: boolean): void {
		this.actionsEnforced = enforce;
	}

	isInAction(): boolean {
		return this.inAction;
	}

	isInBatch(): boolean {
		return this.inBatch;
	}

	isObserved(node: ObservableNode): boolean {
		return (
			node.graph === this &&
			(node.observers.size > 0 || this.potentialUnObserved.has(node))
		);
	}

	isPotentiallyStale(node: Computed<unknown>): boolean {
		return this.potentialStale.has(node);
	}

	isTracking(): boolean {
		return this.topOfRunStack != null;
	}

	onReactionsComplete(callback: () => void): () => void {
		this.reactionsCompleteCallbacks.add(callback);

		return (): void => {
			this.reactionsCompleteCallbacks.delete(callback);
		};
	}

	onObservedStateChange(
		node: ObservableNode,
		callback: (observing: boolean) => void
	): () => void {
		let callbacks = this.onObservedStateChangeCallbacks.get(node);
		if (!callbacks) {
			callbacks = new Set();
			this.onObservedStateChangeCallbacks.set(node, callbacks);
		}

		callbacks.add(callback);

		return (): void => {
			callbacks!.delete(callback);
			if (callbacks!.size === 0) {
				this.onObservedStateChangeCallbacks.delete(node);
			}
		};
	}

	// remove an observer from the graph, can happen when a listener is
	// unsubscribed from or when a computed is no longer observed
	// or when a derivation has ended and we want to clear cached values
	// for unobserved computed
	remove(node: ObserverNode, forceUnObserve: boolean = false): void {
		const wasObserved =
			forceUnObserve ||
			(node.nodeType === nodeTypes.computed && this.isObserved(node));

		node.observing.forEach((o) => {
			o.observers.delete(node);
			if (!this.isObserved(o)) {
				if (o.nodeType === nodeTypes.computed && !o.isKeepAlive()) {
					this.remove(o, true);
				} else {
					this.notifyObservedState(o, false);
				}
			}
		});
		node.observing.clear();

		// in case we are disposing a listener while it is running
		const runStackIndex = this.runStack.indexOf(node);
		if (runStackIndex >= 0) {
			this.runStack[runStackIndex] = null;
		}

		if (node.nodeType === nodeTypes.computed) {
			node.clear();
			wasObserved && this.notifyObservedState(node, false);
		}
	}

	// register an observable change which will propagate the change to all
	// dependencies, invaliding computed nodes and queuing up listener nodes
	// for execution.
	reportChanged(node: ObservableNode, oldValue?: unknown): void {
		if (this.runStack.length && !!this.topOfRunStack && this.isObserved(node)) {
			// we ignore the change if the change occurred within the same reaction in
			// which it was initially observed. This is to allow for creating observables
			// in reactions and mutating them further.
			if (node.observers.has(this.topOfRunStack) && node.observers.size === 1) {
				return;
			}

			throw new Error(
				"Can't change an observable during a reaction or within a computed"
			);
		}

		if (this.actionsEnforced && !this.inAction) {
			throw new Error(
				"strict actions are enforced. Attempted to modify an observed observable outside of an action"
			);
		}

		// if we're not currently in a action start a new one
		if (!this.inAction) {
			try {
				this.startAction();
				this.reportChanged(node, oldValue);
			} finally {
				this.endAction();
			}
			return;
		}

		// keep track of the old value to ensure it changed when the batch
		// is completed
		if (!this.changedObservables.has(node)) {
			this.changedObservables.set(node, oldValue);
		}

		// propagate the change down the graph until we reach the listeners
		this.propagateChange(node);
	}

	// register an observable read with the top most observer on the run stack
	reportObserved(node: ObservableNode): void {
		const topOfRunStack = this.topOfRunStack;

		// we only care about an observable being accessed if there's
		// currently an observer running
		if (topOfRunStack && !topOfRunStack.observing.has(node)) {
			// if this is the first time an observable is being observed ...
			if (!this.isObserved(node)) {
				this.notifyObservedState(node, true);
			}

			// create two-way link between observer and observable
			node.observers.add(topOfRunStack);
			topOfRunStack.observing.add(node);
		}
	}

	// run an observer method and listen to any `reportObserved` calls from observables
	// that were accessed during this time
	runObserver<T>(
		node: ObserverNode,
		observerMethod: () => T,
		context: unknown = null
	): T {
		let value: T;

		// Clear out all observer links from last run
		node.observing.forEach((n) => {
			n.observers.delete(node);

			if (n.observers.size === 0) {
				// keep track of all nodes that might lose their only subscriber
				// `onBecomeUnobserved` needs to be called on them if they do
				this.potentialUnObserved.add(n);
			}
		});
		node.observing.clear();
		this.runStack.push(node);

		try {
			value = observerMethod.call(context);
			if (node.nodeType === nodeTypes.computed) {
				this.potentialStale.delete(node);
			}
		} finally {
			// computed values are cached while an observer is running need to track
			// them and clear them out when the top most observer is completed
			if (node.nodeType === nodeTypes.computed) {
				this.invokedComputed.add(node);
			}

			this.runStack.pop();

			if (this.runStack.length === 0) {
				// if we're not in a batch we can clean up any derived computed that are not
				// observed but were cached for the duration of the derivation.
				// if we're in an batch, that clean up will be performed after the batch
				// is completed.
				if (!this.inBatch) {
					this.clearInvokedComputed();
				}

				// once done with the runstack we need to go through all nodes
				// that were marked as potential to be unobserved and if they no
				// longer have any observers call `onBecomeUnobserved` on them.
				this.potentialUnObserved.forEach((observable) => {
					if (observable.observers.size === 0) {
						if (observable.nodeType === nodeTypes.computed) {
							this.remove(observable);
						} else {
							this.notifyObservedState(observable, false);
						}
					}
				});
				this.potentialUnObserved.clear();
			}
		}

		return value;
	}

	runInAction<T>(fn: () => T, untracked = true): T {
		let result: unknown;
		if (this.taskDepth === 0) {
			this.taskCalledStack.length = 0;
		}

		this.taskDepth++;

		this.taskCalledStack.push(false);

		try {
			this.startAction();
			result = untracked ? this.untracked(fn) : fn();
		} finally {
			if (this.taskCalledStack[this.taskDepth - 1]) {
				if (typeof (result as Promise<unknown>)?.finally !== "function") {
					this.taskDepth--;
					throw new Error(
						"lobx: [FATAL] when task is used in an action that action must return a promise, instead got :" +
							typeof result
					);
				}
				result = (result as Promise<T>).finally(() => {
					this.endAction();
				});
			} else {
				this.endAction();
			}

			this.taskDepth--;
		}

		return result as T;
	}

	task<T>(promise: Promise<T>): Promise<T> {
		if (!this.inAction) {
			throw new Error("lobx: can't call `task` outside of an action");
		}
		this.endAction();
		this.taskCalledStack[this.taskDepth - 1] = true;
		return Promise.resolve(promise).finally(() => {
			this.startAction();
		});
	}

	batch<T>(fn: () => T): T {
		let result: T;
		try {
			this.startBatch();
			result = fn();
		} finally {
			this.endBatch();
		}

		return result;
	}

	endAction(): void {
		this.endBatch();
	}

	startAction(): void {
		this.inAction = true;
		this.startBatch();
	}

	endBatch(): void {
		if (this.callDepth === 0) {
			throw new Error(
				"lobx: attempted to end a batch/action that has not been started"
			);
		}

		// if we're ending the outer most batch
		if (this.callDepth === 1) {
			let reactionsExecuted = false;

			try {
				// loop through all the affected listeners and filter out
				// the listeners whose observables did not produce a new value
				this.queuedListeners.forEach((l) => {
					// we remove the listener from the queue so that it can be re-added
					// in the case that a reaction performs a mutation
					// this.queuedListeners.delete(l);
					// computed might re-evaluate here in order to determine if a new
					// value was produced
					if (this.hasChanged(l)) {
						// perform reaction if any of the dependents have changed
						l.react();
						reactionsExecuted = true;

						// after a reaction it's possible that we queued another listener
						// this can occur if a reaction made a further mutation
						// if that happens the listener will be added to the `queuedListeners` Set
						// and will eventually run in this forEach loop.
					}
				});
			} finally {
				this.inBatch = false;
				this.inAction = false;
				this.queuedListeners.clear();
				this.changedObservables.clear();

				// All computed nodes marked potentially stale are now confirmed stale
				// need to reset them
				this.potentialStale.forEach((n) => {
					n.clear();
				});
				this.potentialStale.clear();

				// clean up any unobserved computed that were cached for the duration
				// of this batch.
				this.clearInvokedComputed();
				this.callDepth--;

				// If a reaction occurred during this batch invoke `onReactionsComplete` callbacks
				if (reactionsExecuted) {
					this.reactionsCompleteCallbacks.forEach((c) => c());
				}
			}
		} else {
			this.callDepth--;
		}
	}

	startBatch(): void {
		this.callDepth++;
		if (!this.inBatch) {
			this.inBatch = true;
		}
	}

	untracked<T>(fn: () => T): T {
		try {
			this.runStack.push(null);
			return fn();
		} finally {
			this.runStack.pop();
		}
	}
}
