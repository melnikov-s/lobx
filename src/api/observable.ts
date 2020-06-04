import ObservableValue from "../core/types/observableValue";
import { resolveGraph, Graph } from "./graph";
import { defaultEquals, isNonPrimitive } from "../utils";
import {
	getObservable,
	getObservableWithConfig
} from "../core/types/utils/lookup";
import { Configuration, ConfigurationGetter } from "../core/types/object";

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

function observableConfigure<T extends object, S extends T>(
	config: Configuration<T> | ConfigurationGetter<S>,
	target: T,
	opts?: Options
): T;
function observableConfigure<T extends new (args: unknown[]) => unknown>(
	config: Configuration<InstanceType<T>>,
	target: T,
	opts?: Options
): T;

function observableConfigure<T extends object>(
	config: Configuration<T> | ConfigurationGetter<T>,
	target: T,
	opts?: Options
): T {
	return getObservableWithConfig(target, resolveGraph(opts?.graph), config);
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
observable.configure = observableConfigure;

export default observable as typeof observable & {
	box: typeof observableBox;
	configure: typeof observableConfigure;
};
