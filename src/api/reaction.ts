import makeListener, { Listener } from "./listener";
import { Graph } from "./graph";

export default function reaction<T>(
	track: () => T,
	callback: (a: T, listener: Listener) => void,
	opts?: { graph?: Graph }
): () => void {
	let value: T;

	const listener = makeListener(() => {
		const newValue = listener.track(track);

		if (newValue !== value) {
			value = newValue;
			callback(value, listener);
		}
	}, opts);

	value = listener.track(track);

	return function (): void {
		listener.dispose();
	};
}
