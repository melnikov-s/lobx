import ObservableValue from "../core/types/observableValue";
import { resolveGraph, Graph } from "./graph";
import { defaultEquals, isNonPrimitive } from "../utils";
import {
	getObservable,
	getObservableWithConfig,
	isObservable
} from "../core/types/utils/lookup";
import { Configuration } from "../core/types/object";
import { getAdministration } from "../core/types/utils/Administration";

export type Observable<T> = {
	equals: (value: T) => boolean;
	get: () => T;
	set: (newValue: T) => T;
};

type Options = {
	equals?: typeof defaultEquals;
	graph?: Graph;
};

function observableBox<T>(initialValue: T, opts?: Options): Observable<T> {
	return new ObservableValue<T>(
		initialValue,
		resolveGraph(opts?.graph),
		opts?.equals
	);
}

function observableConfigure<T extends object>(
	config: Configuration<T>,
	target: T,
	opts?: Options
): T;
function observableConfigure<T extends new (args: unknown[]) => unknown>(
	config: Configuration<InstanceType<T>>,
	target: T,
	opts?: Options
): T;

function observableConfigure<T extends object>(
	config: Configuration<T>,
	target: T,
	opts?: Options
): T {
	return getObservableWithConfig(config, target, resolveGraph(opts?.graph));
}

// TOOD: support onbecomeobserved/ onbecomeunobserved
// further todo: it needs to be callback with an unsubscribe like mobx
function observable<T extends object>(object: T, opts?: Options): T {
	if (isNonPrimitive(object)) {
		return getObservable(object, resolveGraph(opts?.graph));
	}

	throw new Error(
		`lobx: observable is only for nom primitive values. Got ${typeof object} instead. Use observable.box for primitive values.`
	);
}

observable.box = observableBox;
observable.configure = observableConfigure;

export default observable as typeof observable & {
	box: typeof observableBox;
	configure: typeof observableConfigure;
};
