import ObservableValue from "../core/types/observableValue";
import { resolveGraph, Graph } from "./graph";
import { defaultEquals, isNonPrimitive } from "../utils";
import { getObservable } from "../core/types/utils/lookup";

export type Observable<T> = {
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

function observableBox<T>(initialValue: T, opts?: Options): Observable<T> {
	return new ObservableValue<T>(
		initialValue,
		resolveGraph(opts?.graph),
		opts?.onBecomeObserved,
		opts?.onBecomeUnobserved,
		opts?.equals
	);
}

function observable<T extends object>(object: T, opts?: Options): T {
	if (isNonPrimitive(object)) {
		return getObservable(object, resolveGraph(opts?.graph));
	}

	throw new Error(
		`lobx: observable is only for nom primitive values. Got ${typeof object} instead. Use observable.box for primitive values.`
	);
}

observable.box = observableBox;

export default observable as typeof observable & { box: typeof observableBox };
