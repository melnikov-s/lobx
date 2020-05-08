import AtomNode from "../core/nodes/atom";
import { resolveGraph, Graph } from "./graph";

export type Atom<T = unknown> = {
	reportChanged: (value?: T) => void;
	reportObserved: () => boolean;
};

export default function<T = unknown>(opts?: {
	graph?: Graph;
	onBecomeObserved?: () => void;
	onBecomeUnobserved?: () => void;
	equals?: (v: T) => boolean;
}): Atom<T> {
	return new AtomNode(
		resolveGraph(opts?.graph),
		opts?.onBecomeObserved,
		opts?.onBecomeUnobserved,
		opts?.equals
	);
}
