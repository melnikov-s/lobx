import ListenerNode from "../core/nodes/listener";
import { resolveGraph, Graph } from "./graph";

export type Listener<T> = Omit<ListenerNode<T>, "nodeType" | "react">;

export default function<T>(
  callback: () => void,
  opts?: { graph?: Graph }
): Listener<T> {
  return new ListenerNode(resolveGraph(opts?.graph), callback);
}
