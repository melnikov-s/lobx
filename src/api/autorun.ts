import makeListener, { Listener } from "./listener";
import { Graph } from "./graph";

export default function<T>(
  callback: (t: Listener<T>) => void,
  opts?: { graph?: Graph }
): () => void {
  const boundCallback: () => void = () => callback.call(null, listener);

  const listener = makeListener<T>(() => {
    listener.track(boundCallback);
  }, opts);

  listener.track(boundCallback);

  return function(): void {
    listener.dispose();
  };
}
