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

                 observers occupy the top of the graph
                 and have no dependencies
 +------------+  +------------+  +-------------+
 |            |  |            |  |             |
 |  observer  |  |  observer  |  |  observer   |
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
    |      can be n levels deep, having observers       |
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
                               dependants

*/

export const nodeTypes = {
	atom: 1,
	observable: 2,
	computed: 3,
	listener: 4
} as const;

interface Observable {
	observers: Set<ObserverNode>;
	onBecomeObserved?: () => void;
	onBecomeUnobserved?: () => void;
}

interface Observer {
	observing: Set<ObservableNode>;
}

export interface Atom<T = unknown> extends Observable {
	nodeType: typeof nodeTypes.atom;
	equals(a: T): boolean;
}

export interface ObservableValue<T = unknown> extends Observable {
	nodeType: typeof nodeTypes.observable;
	value: T | null;
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
export type ObservableNode = Computed | ObservableValue | Atom;
export type Node = ObserverNode | ObservableNode;

export default class Graph {
	private changedObservables: Map<Node, unknown> = new Map();
	private inAction = false;
	private updatingListeners = false;
	private invokedComputed: Set<Computed<unknown>> = new Set();
	private potentialUnObserved: Set<ObservableNode> = new Set();
	private potentialStale: Set<Computed<unknown>> = new Set();
	private queuedListeners: Set<Listener> = new Set();
	private runStack: (ObserverNode | null)[] = [];

	// clean up any unobserved computed nodes that were cached for the
	// duration of an action or derivation
	private clearInvokedComputed(): void {
		this.invokedComputed.forEach(c => {
			if (c.observers.size === 0 && !c.isKeepAlive()) {
				this.remove(c);
			}
		});
		this.invokedComputed.clear();
	}

	// determine if a node has changed it's value during an action
	private hasChanged(node: Node): boolean {
		let changed = false;

		switch (node.nodeType) {
			case nodeTypes.atom:
			case nodeTypes.observable:
				changed =
					this.changedObservables.has(node) &&
					!node.equals(this.changedObservables.get(node));
				break;
			case nodeTypes.computed:
				if (!this.changedObservables.has(node)) {
					return false;
				}

				node.observing.forEach(o => {
					changed = changed || this.hasChanged(o);
				});

				if (!changed) {
					this.potentialStale.delete(node);
				}

				changed = changed && !node.equals(this.changedObservables.get(node));
				break;
			case nodeTypes.listener:
				node.observing.forEach(o => {
					changed = changed || this.hasChanged(o);
				});
				break;
		}

		return changed;
	}

	// propagate a change to an observable down the graph during an action
	// in order to mark any affected computed nodes as a potentially stale
	// and collect all dependent listeners
	private propagateChange(node: ObservableNode): void {
		node.observers.forEach(childNode => {
			if (childNode.nodeType === nodeTypes.computed) {
				// if this is the first time this computed node was changed within
				// an action we collect its value for later comparison
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
				// store all affected listeners for potential invocation when action
				// is complete
				this.queuedListeners.add(childNode as Listener);
			}
		});
	}

	private get topOfRunStack(): ObserverNode | null {
		return this.runStack[this.runStack.length - 1] || null;
	}

	isInAction(): boolean {
		return this.inAction;
	}

	isObserved(node: ObservableNode): boolean {
		return node.observers.size > 0 || this.potentialUnObserved.has(node);
	}

	isPotentialyStale(node: Computed<unknown>): boolean {
		return this.potentialStale.has(node);
	}

	isTracking(): boolean {
		return this.topOfRunStack != null;
	}

	// remove an observer from the graph, can happen when a listener is
	// unsubscribed from or when a computed is no longer observed
	// or when a derivation has ended and we want to clear cached values
	// for unobserved computeds
	remove(node: ObserverNode, forceUnObserve: boolean = false): void {
		const wasObserved =
			forceUnObserve ||
			(node.nodeType === nodeTypes.computed && this.isObserved(node));

		node.observing.forEach(o => {
			o.observers.delete(node);
			if (!this.isObserved(o)) {
				if (o.nodeType === nodeTypes.computed && !o.isKeepAlive()) {
					this.remove(o, true);
				} else {
					o.onBecomeUnobserved?.();
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
			wasObserved && node.onBecomeUnobserved?.();
		}
	}

	// register an observable change which will propagate the change to all
	// dependencies, invaliding computed nodes and queuing up listener nodes
	// for execution.
	reportChanged(node: ObservableNode, oldValue?: unknown): void {
		if (this.runStack.length && !!this.topOfRunStack && this.isObserved(node)) {
			throw new Error(
				"Can't change an observable during a reaction or within a computed"
			);
		}

		// if we're not currently in an action start a new action
		if (!this.inAction) {
			this.runAction(() => this.reportChanged(node, oldValue));

			return;
		}

		// keep track of the old value to ensure it changed when the action
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
				node.onBecomeObserved?.();
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
		node.observing.forEach(n => {
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
				// if we're not in action we can clean up any derived computeds that are not
				// observed but were cached for the duration of the derivation.
				// if we're in an action, that clean up will be performed after the action
				// is completed.
				if (!this.inAction) {
					this.clearInvokedComputed();
				}

				// once done with the runstack we need to go through all nodes
				// that were marked as potential to be unobserved and if they no
				// longer have any observers call `onBecomeUnobserved` on them.
				this.potentialUnObserved.forEach(observable => {
					if (observable.observers.size === 0) {
						if (observable.nodeType === nodeTypes.computed) {
							this.remove(observable);
						} else {
							observable.onBecomeUnobserved?.();
						}
					}
				});
				this.potentialUnObserved.clear();
			}
		}

		return value;
	}

	runAction<T>(fn: () => T): T {
		// used to keep track of the root action in case an action is invoked within another
		let isRootAction = false;

		if (!this.inAction) {
			// make actions untracked
			this.runStack.push(null);
			this.inAction = true;
			isRootAction = true;
		}

		let result: T;

		try {
			// run the action
			result = fn();
		} finally {
			// clean up and trigger all affected reactions
			if (isRootAction) {
				const updatedListeners: Listener[] = [];
				this.runStack.pop();

				try {
					// loop through all the affected listeners and filter out
					// the listeners whose obesrvables did not produce a new value
					this.queuedListeners.forEach(l => {
						// computed might re-evaluate here in order to determine if a new
						// value was prodcued
						if (this.hasChanged(l)) {
							updatedListeners.push(l);
						}
					});
				} finally {
					this.inAction = false;
					this.queuedListeners.clear();
					this.changedObservables.clear();

					// All computed nodes marked potentially stale are now confirmed stale
					// need to reset them
					this.potentialStale.forEach(n => {
						n.clear();
					});
					this.potentialStale.clear();

					let rootUpdatingListeners = false;

					try {
						// invoke all affected listeners
						rootUpdatingListeners = !this.updatingListeners;
						this.updatingListeners = true;
						updatedListeners.forEach(l => l.react());
					} finally {
						this.updatingListeners = false;
						// we might have re-enetered an action from firing our listeners.
						// we only want to clean up our computed if this was the root action
						if (rootUpdatingListeners) {
							// clean up any unobserved computed that were cached for the duration
							// of this action.
							this.clearInvokedComputed();
						}
					}
				}
			}
		}

		return result;
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
