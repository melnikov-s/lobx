import CoreGraph, { ObservableNode } from "../core/graph";
import { Observable } from "./observable";
import { Computed } from "./computed";
import { Atom } from "./atom";

export type Graph = {
  isInAction: () => boolean;
  isObserved: (node: ObservableNode) => boolean;
  isTracking: () => boolean;
  runAction: <T>(fn: () => T) => T;
  untracked: <T>(fn: () => T) => T;
};

export default function makeGraph(): Graph {
  return new CoreGraph();
}

let defaultGraph: Graph;

export function getDefaultGraph(): Graph {
  return (defaultGraph = defaultGraph ?? makeGraph());
}

export function resolveGraph(graph: Graph | null | undefined): CoreGraph {
  return (graph ?? getDefaultGraph()) as CoreGraph;
}

type GraphOptions = { graph?: Graph };

export function action<T extends unknown[], U>(
  func: (...args: T) => U,
  opts?: GraphOptions
): (...args: T) => U {
  return function(this: unknown, ...args: T): U {
    return runInAction(() => func.apply(this, args), opts) as U;
  };
}

export function isObserved(
  observable: Observable<unknown> | Computed<unknown> | Atom<unknown>,
  { graph = defaultGraph }: GraphOptions = {}
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o: any = observable;

  return o.graph === graph && graph.isObserved(o);
}

export function isInAction(opts?: GraphOptions): boolean {
  return resolveGraph(opts?.graph).isInAction();
}

export function isTracking(opts?: GraphOptions): boolean {
  return resolveGraph(opts?.graph).isTracking();
}

export function runInAction<T>(fn: () => T, opts?: GraphOptions): T {
  return resolveGraph(opts?.graph).runAction(fn);
}

export function untracked<T>(fn: () => T, opts?: GraphOptions): T {
  return resolveGraph(opts?.graph).untracked(fn);
}
