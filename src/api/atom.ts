import AtomNode from "../core/nodes/atom";
import { resolveGraph, Graph } from "./graph";

export type Atom = Omit<
  AtomNode,
  "onBecomeObserved" | "onBecomeUnobserved" | "observers" | "nodeType"
>;

export default function(opts?: {
  graph?: Graph;
  onBecomeObserved?: () => void;
  onBecomeUnobserved?: () => void;
}): Atom {
  return new AtomNode(
    resolveGraph(opts?.graph),
    opts?.onBecomeObserved,
    opts?.onBecomeUnobserved
  );
}
