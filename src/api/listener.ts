import ListenerNode from "../core/nodes/listener";
import { resolveGraph, Graph } from "./graph";

export type Listener<T = unknown> = {
	dispose: () => void;
	track: (trackFn: () => void | T) => void | T;
};

export default function<T>(
	callback: () => void,
	opts?: { graph?: Graph }
): Listener<T> {
	return new ListenerNode(resolveGraph(opts?.graph), callback);
}
