import ListenerNode from "../core/nodes/listener";
import { resolveGraph, Graph } from "./graph";

export type Listener = {
	dispose: () => void;
	track: <T>(trackFn: () => T) => T;
};

export default function(
	callback: () => void,
	opts?: { graph?: Graph }
): Listener {
	return new ListenerNode(resolveGraph(opts?.graph), callback);
}
