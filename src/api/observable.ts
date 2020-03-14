import ObservableNode from "../core/nodes/observable";
import { resolveGraph, Graph } from "./graph";
import { defaultEquals } from "../utils";

export type Observable<T> = Omit<
  ObservableNode<T>,
  "onBecomeObserved" | "onBecomeUnobserved" | "value" | "observers" | "nodeType"
>;

export default function<T>(
  initialValue: T,
  opts?: {
    equals?: typeof defaultEquals;
    graph?: Graph;
    onBecomeObserved?: () => void;
    onBecomeUnobserved?: () => void;
  }
): Observable<T> {
  return new ObservableNode<T>(
    resolveGraph(opts?.graph),
    initialValue,
    opts?.equals,
    opts?.onBecomeObserved,
    opts?.onBecomeUnobserved
  );
}
