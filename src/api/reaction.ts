import makeListener, { Listener } from "./listener";
import { Graph } from "./graph";

export default function<T>(
  track: () => T,
  callback: (a?: T, listener?: Listener<T>) => void,
  opts?: { graph?: Graph }
): () => void {
  let value: T;

  const listener = makeListener<T>(() => {
    const newValue = listener.track(track) as T;

    if (newValue !== value) {
      value = newValue;
      callback(value, listener);
    }
  }, opts);

  value = listener.track(track) as T;

  return function(): void {
    listener.dispose();
  };
}
