import makeListener, { Listener } from "./listener";
import { Graph, resolveGraph } from "./graph";
import reaction from "./reaction";
import autorun from "./autorun";

export type Scheduler = {
	listener: (callback: () => void) => Listener;
	reaction: <T>(
		track: () => T,
		callback: (a: T, listener: Listener) => void
	) => () => void;
	autorun: (callback: (t: Listener) => void) => () => void;
};

function schedule(
	scheduler: (reactions: ScheduledReactions) => void,
	opts?: { graph?: Graph }
): Scheduler {
	const graph = resolveGraph(opts?.graph);
	const reactions = new ScheduledReactions(graph);
	let unsub: () => void;

	let isReacting = false;

	function applySchedule(
		callback: Function,
		autorun: boolean = false
	): () => void {
		let ran = false;
		return (...args) => {
			if (autorun && !ran) {
				callback();
			}

			ran = true;

			if (reactions.size === 0) {
				unsub = graph!.onReactionsComplete(() => {
					if (reactions.size > 0 && !isReacting) {
						try {
							// if a reaction causes further transactions we ignore those
							isReacting = true;
							scheduler(reactions);
						} finally {
							isReacting = false;
							reactions!.clear();
							unsub!();
						}
					}
				});
			}

			const listener = args[args.length - 1] as Listener;

			reactions.add(callback, listener, args);
		};
	}

	return {
		listener(callback: () => void) {
			return makeListener(applySchedule(callback), { graph });
		},
		reaction<T>(track: () => T, callback: (a: T, listener: Listener) => void) {
			return reaction(track, applySchedule(callback), { graph });
		},
		autorun(callback: (t: Listener) => void) {
			return autorun(applySchedule(callback, true), { graph });
		},
	};
}

class ScheduledReactions {
	private reactions: Set<Function> = new Set();
	private argsMap: WeakMap<Function, unknown[]> = new WeakMap();
	private listenerMap: WeakMap<Function, Listener> = new WeakMap();
	private graph: Graph;

	constructor(graph?: Graph) {
		this.graph = resolveGraph(graph);
	}

	get size(): number {
		return this.reactions.size;
	}

	add(callback: Function, listener: Listener, args: unknown[]): void {
		this.reactions.add(callback);
		this.argsMap.set(callback, args);
		this.listenerMap.set(callback, listener);
	}

	merge(r: ScheduledReactions): void {
		r.reactions.forEach((reaction) => {
			this.reactions.add(reaction);
			this.argsMap.set(reaction, r.argsMap.get(reaction)!);
			this.listenerMap.set(reaction, r.listenerMap.get(reaction)!);
		});
	}

	flush(): void {
		this.graph.batch(() => {
			try {
				this.reactions.forEach((reaction) => {
					const args = this.argsMap.get(reaction) ?? [];
					const listener = this.listenerMap.get(reaction)!;
					!listener.isDisposed && reaction(...args);
				});
			} finally {
				this.reactions.clear();
			}
		});
	}

	clear(): void {
		this.reactions.clear();
	}
}

export function createScheduler(
	scheduler: (fn: () => void) => void,
	opts?: {
		graph?: Graph;
	}
): Scheduler {
	const reactions = new ScheduledReactions(opts?.graph);

	return schedule((newReactions: ScheduledReactions) => {
		if (reactions.size === 0) {
			reactions.merge(newReactions);
			scheduler(() => {
				reactions.flush();
			});
		} else {
			reactions.merge(newReactions);
		}
	}, opts);
}
