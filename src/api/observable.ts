import ObservableValue from "../types/observableValue";
import { resolveGraph, Graph } from "./graph";
import { defaultEquals, isNonPrimitive, isPropertyKey } from "../utils";
import {
	getObservable,
	getObservableConfiguration,
	getObservableWithConfig,
} from "../types/utils/lookup";
import {
	Configuration,
	ConfigurationGetter,
	propertyType,
	ObservableOptions as ObjectObservableOptions,
} from "../types/object";

export type Observable<T> = {
	equals: (value: T) => boolean;
	get: () => T;
	set: (newValue: T) => T;
};

export type ObservableOptions = {
	equals?: typeof defaultEquals;
	graph?: Graph;
};

function observableBox<T>(
	initialValue: T,
	opts?: ObservableOptions
): Observable<T> {
	return new ObservableValue<T>(
		initialValue,
		resolveGraph(opts?.graph),
		opts?.equals
	);
}

function observableWithOptions(options: Omit<ObjectObservableOptions, "type">) {
	return (target: any, propertyKey: string): any => {
		const config = getObservableConfiguration(target.constructor);
		config[propertyKey] = propertyType.observable(options);

		return undefined;
	};
}

function observableConfigure<T extends object, S extends T>(
	config: Configuration<T> | ConfigurationGetter<S>,
	target: T,
	opts?: ObservableOptions
): T;
function observableConfigure<T extends new (args: unknown[]) => unknown>(
	config: Configuration<InstanceType<T>>,
	target: T,
	opts?: ObservableOptions
): T;

function observableConfigure<T extends object>(
	config: Configuration<T> | ConfigurationGetter<T>,
	target: T,
	opts?: ObservableOptions
): T {
	return getObservableWithConfig(target, resolveGraph(opts?.graph), config);
}

function observable<T extends object>(object: T, opts?: ObservableOptions): T;

function observable(target: unknown, propertyKey: string): any;

function observable<T>(...args: unknown[]): unknown {
	if (isPropertyKey(args[1])) {
		const [target, propertyKey] = args as [any, PropertyKey];

		const config = getObservableConfiguration(target.constructor);
		config[propertyKey] = propertyType.observable;

		return undefined;
	} else {
		const [object, opts] = args as [T, ObservableOptions];
		if (isNonPrimitive(object)) {
			return getObservable(object, resolveGraph(opts?.graph), undefined, true);
		}

		throw new Error(
			`observable is only for nom primitive values. Got ${typeof object} instead. Use observable.box for primitive values.`
		);
	}
}

observable.box = observableBox;
observable.configure = observableConfigure;
observable.withOptions = observableWithOptions;

export default observable as typeof observable & {
	box: typeof observableBox;
	configure: typeof observableConfigure;
	withOptions: typeof observableWithOptions;
};
