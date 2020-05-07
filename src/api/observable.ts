import ObservableNode from "../core/nodes/observable";
import { resolveGraph, Graph } from "./graph";
import { defaultEquals } from "../utils";

export type Observable<T> = {
  readonly comparator: <T>(a: T, b: T) => boolean;
  equals: (value: T) => boolean;
  get: () => T;
  set: (newValue: T) => T;
};

type Options = {
  equals?: typeof defaultEquals;
  graph?: Graph;
  onBecomeObserved?: () => void;
  onBecomeUnobserved?: () => void;
};

export default function observable<T>(
  initialValue: T,
  opts?: Options
): Observable<T> {
  return new ObservableNode<T>(
    resolveGraph(opts?.graph),
    initialValue,
    opts?.equals,
    opts?.onBecomeObserved,
    opts?.onBecomeUnobserved
  );
}
