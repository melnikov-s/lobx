import CoreGraph, { ObservableNode } from "../core/graph";
import { getAdministration, isObservable } from "../types/utils/lookup";
import AtomNode from "../core/nodes/atom";
import ComputedNode from "../core/nodes/computed";
import ObservableValue from "../types/observableValue";

export type Graph = {
	enforceActions: (enforce: boolean) => void;
	isInAction: () => boolean;
	isInBatch: () => boolean;
	isObserved: (node: ObservableNode) => boolean;
	isTracking: () => boolean;
	runInAction: <T>(fn: () => T) => T;
	batch: <T>(fn: () => T) => T;
	startAction: () => void;
	endAction: () => void;
	startBatch: () => void;
	endBatch: () => void;
	untracked: <T>(fn: () => T) => T;
	onReactionsComplete: (callback: () => void) => () => void;
	task<T>(promise: Promise<T>): Promise<T>;
};

export default function makeGraph(): Graph {
	return new CoreGraph();
}

let defaultGraph: Graph;

export function getDefaultGraph(): Graph {
	return (defaultGraph = defaultGraph ?? makeGraph());
}

export function setDefaultGraph(graph: Graph): void {
	defaultGraph = graph;
}

export function resolveGraph(graph: Graph | null | undefined): CoreGraph {
	return (graph ?? getDefaultGraph()) as CoreGraph;
}

export function enforceActions(enforce: boolean): void {
	return getDefaultGraph().enforceActions(enforce);
}

export function isObserved(
	observable: unknown,
	{ graph = defaultGraph } = {}
): boolean {
	if (observable instanceof AtomNode || observable instanceof ComputedNode) {
		return graph.isObserved(observable as ObservableNode);
	} else if (observable instanceof ObservableValue) {
		return graph.isObserved(observable.atom);
	} else if (isObservable(observable)) {
		const adm = getAdministration(observable as object);
		return graph.isObserved(adm.atom);
	}

	return false;
}

export function isInAction(): boolean {
	return getDefaultGraph().isInAction();
}

export function isInBatch(): boolean {
	return getDefaultGraph().isInBatch();
}

export function isTracking(): boolean {
	return getDefaultGraph().isTracking();
}

export function batch<T>(fn: () => T): T {
	return getDefaultGraph().runInAction(fn);
}

export function runInAction<T>(fn: () => T): T {
	return getDefaultGraph().runInAction(fn);
}

export function task<T>(promise: Promise<T>): Promise<T> {
	return getDefaultGraph().task(promise);
}

export function untracked<T>(fn: () => T): T {
	return getDefaultGraph().untracked(fn);
}

export function getObservableSource<T extends object>(obj: T): T {
	const adm = getAdministration(obj);
	return adm?.source;
}

export function forceChange<T extends object>(...args: T[]): void {
	for (let i = 0; i < args.length; i++) {
		const adm = getAdministration(args[i]);
		if (!adm) {
			throw new Error(`forceChange called on an invalid object`);
		}
		adm.forceChange();
	}
}

export function forceObserve<T extends object>(...args: T[]): void {
	for (let i = 0; i < args.length; i++) {
		const adm = getAdministration(args[i]);
		if (!adm) {
			throw new Error(`forceObserve called on an invalid object`);
		}
		adm.forceObserve();
	}
}

export function onReactionsComplete(callback: () => void): () => void {
	return getDefaultGraph().onReactionsComplete(callback);
}

type KeyType<T> = T extends Set<infer R>
	? R
	: T extends Map<infer K, unknown>
	? K
	: T extends WeakSet<infer R>
	? R
	: T extends WeakMap<infer K, unknown>
	? K
	: string | number | symbol;

export function onObservedStateChange<T extends object>(
	obj: T,
	key: KeyType<T>,
	callback: (observing: boolean) => void
): () => void;
export function onObservedStateChange<T extends object>(
	obj: T,
	callback: (observing: boolean) => void
): () => void;
export function onObservedStateChange<T extends object>(
	obj: T,
	keyOrCallback: unknown | (() => void),
	callback?: (observing: boolean) => void
): () => void {
	const cb =
		typeof keyOrCallback === "function"
			? (keyOrCallback as () => void)
			: callback!;
	const key = callback ? keyOrCallback : undefined;

	if (
		obj instanceof ObservableValue ||
		obj instanceof ComputedNode ||
		obj instanceof AtomNode
	) {
		if (key) {
			throw new Error(
				`onObservedStateChange key param not supported for observable box or computed value`
			);
		}

		return obj.graph.onObservedStateChange(
			(obj as any).atom || (obj as any),
			cb
		);
	}

	if (!isObservable(obj)) {
		throw new Error(
			`onObservedStateChange can only be called on observable values`
		);
	}

	const adm = getAdministration(obj);

	return adm.onObservedStateChange(cb, key as PropertyKey);
}
