import ObservableValue from "../types/observableValue";
import { resolveGraph, Graph } from "./graph";
import { defaultEquals, isNonPrimitive, isPropertyKey } from "../utils";
import {
	getObservable,
	getCtorConfiguration,
	getObservableWithConfig,
} from "../types/utils/lookup";
import {
	Configuration,
	ConfigurationGetter,
	propertyType,
	getOpts,
	withDefaultConfig,
} from "../types/utils/configuration";

export type ObservableBox<T> = {
	equals: (value: T) => boolean;
	get: () => T;
	set: (newValue: T) => T;
};

export type ObservableOptions = {
	graph?: Graph;
};

type ObservableOptionsConfigure = ObservableOptions & {
	withDefaults?: boolean;
};

function observableBox<T>(
	initialValue: T,
	opts?: ObservableOptions & { equals?: typeof defaultEquals }
): ObservableBox<T> {
	return new ObservableValue<T>(
		initialValue,
		resolveGraph(opts?.graph),
		opts?.equals
	);
}

function observableConfigure<T extends object, S extends T>(
	config: Configuration<T> | ConfigurationGetter<S>,
	target: T,
	opts?: ObservableOptionsConfigure
): T;

function observableConfigure<T extends object>(
	config: Configuration<T> | ConfigurationGetter<T>
): typeof propertyType.observable;

function observableConfigure<T extends object>(
	config: Configuration<T> | ConfigurationGetter<T>,
	target?: T,
	opts?: ObservableOptionsConfigure
): any {
	if (target) {
		return getObservableWithConfig(
			target,
			resolveGraph(opts?.graph),
			opts?.withDefaults ? withDefaultConfig(config) : config
		);
	} else {
		return {
			...propertyType.observable,
			configuration: config,
		};
	}
}

function observable<T extends object>(object: T, opts?: ObservableOptions): T;

function observable(target: any, propertyKey: string): any;

function observable<T>(...args: unknown[]): unknown {
	if (isPropertyKey(args[1])) {
		const [target, propertyKey] = args as [any, PropertyKey];

		const config = getCtorConfiguration(target.constructor);
		config[propertyKey] = propertyType.observable;

		return undefined;
	} else {
		const [object, opts] = args as [T, ObservableOptions];
		const primitive = !isNonPrimitive(object);
		if (primitive) {
			throw new Error(
				`observable is only for non primitive values. Got ${typeof object} instead. Use observable.box for primitive values.`
			);
		}

		return getObservable(object, resolveGraph(opts?.graph));
	}
}

Object.assign(observable, propertyType.observable);

observable.box = observableBox;
observable.configure = observableConfigure;
observable.opts = getOpts(propertyType.observable);

export default observable as typeof observable & {
	box: typeof observableBox;
	configure: typeof observableConfigure;
	opts: typeof observable.opts;
} & typeof propertyType.observable;
