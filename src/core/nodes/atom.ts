import Graph, { Atom, ObserverNode, nodeTypes } from "../graph";

export default class AtomNode implements Atom {
  readonly nodeType = nodeTypes.atom;
  readonly observers: Set<ObserverNode> = new Set();

  constructor(
    private readonly graph: Graph,
    public readonly onBecomeObserved?: () => void,
    public readonly onBecomeUnobserved?: () => void
  ) {}

  reportChanged(): void {
    if (this.observers.size > 0) {
      this.graph.reportChanged(this);
    }
  }

  reportObserved(): boolean {
    this.graph.reportObserved(this);

    return this.graph.isObserved(this);
  }
}
