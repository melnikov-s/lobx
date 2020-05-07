import ComputedNode from "../core/nodes/computed";
import { resolveGraph, Graph } from "./graph";

export type Computed<T> = {
  equals: (value: T) => boolean;
  isDirty: () => boolean;
  isKeepAlive: () => boolean;
  get: () => T;
  setKeepAlive: (keepAlive: boolean) => void;
};

export default function<T>(
  fn: () => T,
  opts?: {
    graph?: Graph;
    equals?: (a: T, b: T) => boolean;
    keepAlive?: boolean;
    context?: unknown;
    onBecomeObserved?: () => void;
    onBecomeUnobserved?: () => void;
  }
): Computed<T> {
  return new ComputedNode(
    resolveGraph(opts?.graph),
    fn,
    opts?.equals,
    opts?.keepAlive,
    opts?.context,
    opts?.onBecomeObserved,
    opts?.onBecomeUnobserved
  );
}
