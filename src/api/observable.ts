import ObservableValue from "../core/types/observableValue";
import { resolveGraph, Graph } from "./graph";
import { defaultEquals, isNonPrimitive } from "../utils";
import {
	getObservable,
	getObservableWithConfig
} from "../core/types/utils/lookup";
import { propertyType } from "../core/types/object";

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

function observableConfigure<T extends object>(
	config: Partial<Record<keyof T, keyof typeof propertyType>>,
	target: T,
	opts?: Options
): T;
function observableConfigure<T extends new (args: unknown[]) => unknown>(
	config: Partial<Record<keyof InstanceType<T>, keyof typeof propertyType>>,
	target: T,
	opts?: Options
): T;

function observableConfigure<T extends object>(
	config: Partial<Record<keyof T, keyof typeof propertyType>>,
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
