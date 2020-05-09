import CoreGraph, { ObservableNode } from "../core/graph";
import { getAdministration, isObservable } from "../core/types/utils/lookup";
import AtomNode from "../core/nodes/atom";
import ComputedNode from "../core/nodes/computed";
import ObservableValue from "../core/types/observableValue";

export type Graph = {
	enforceActions: (enforce: boolean) => void;
	isInAction: () => boolean;
	isObserved: (node: ObservableNode) => boolean;
	isTracking: () => boolean;
	runInAction: <T>(fn: () => T) => T;
	transaction: <T>(fn: () => T) => T;
	untracked: <T>(fn: () => T) => T;
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

export function action<T extends unknown[], U>(
	func: (...args: T) => U
): (...args: T) => U {
	return function(this: unknown, ...args: T): U {
		return runInAction(() => func.apply(this, args)) as U;
	};
}

export function enforceActions(enforce: boolean): void {
	return getDefaultGraph().enforceActions(enforce);
}

export function isObserved(observable: unknown, graph = defaultGraph): boolean {
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

export function isTracking(): boolean {
	return getDefaultGraph().isTracking();
}

export function transaction<T>(fn: () => T): T {
	return getDefaultGraph().runInAction(fn);
}

export function runInAction<T>(fn: () => T): T {
	return getDefaultGraph().runInAction(fn);
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
			throw new Error(`lobx: forceChange called on an invalid object`);
		}
		adm.forceChange();
	}
}

export function forceObserve<T extends object>(...args: T[]): void {
	for (let i = 0; i < args.length; i++) {
		const adm = getAdministration(args[i]);
		if (!adm) {
			throw new Error(`lobx: forceObserve called on an invalid object`);
		}
		adm.forceObserve();
	}
}
