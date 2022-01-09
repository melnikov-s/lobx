import { defaultEquals, getPropertyDescriptor } from "../../utils";
import { getCtorConfiguration } from "../utils/lookup";

export type ConfigurationTypes =
	| ObservableOptions
	| ComputedOptions
	| ActionOptions;

export type ConfigurationGetter<T> = (
	name: keyof T,
	object: T
) => ConfigurationTypes | undefined;

export type Configuration<T> = Partial<
	Record<keyof T, ConfigurationTypes | undefined>
>;

type Types = "observable" | "computed" | "action";

export type ObservableOptions = {
	type: "observable";
	ref?: boolean;
};

export type ObservableOptionsConfig = ObservableOptions & {
	configuration: Configuration<unknown>;
};

export type ComputedOptions = {
	type: "computed";
	keepAlive?: boolean;
	equals?: typeof defaultEquals;
};
export type ActionOptions = {
	type: "action";
	bound?: boolean;
	untracked?: boolean;
};

type PropertyOptions = {
	observable: ObservableOptions;
	computed: ComputedOptions;
	action: ActionOptions;
};

const observableType: ObservableOptions = {
	type: "observable",
	ref: false,
};
const computedType: ComputedOptions = {
	type: "computed",
	keepAlive: false,
};
const actionType: ActionOptions = { type: "action", untracked: true };

export const propertyType: {
	[key in Types]: PropertyOptions[key];
} = {
	observable: observableType,
	computed: computedType,
	action: actionType,
} as const;

const defaultAction = { ...propertyType.action, untracked: false };

export function defaultConfigGetter(
	key: PropertyKey,
	proxy: object
): ConfigurationTypes {
	const descriptor = getPropertyDescriptor(proxy, key);
	if (descriptor) {
		if (
			typeof descriptor.get === "function" ||
			typeof descriptor.set === "function"
		) {
			return propertyType.computed;
		} else if (typeof descriptor.value === "function") {
			return defaultAction;
		}
	}

	return propertyType.observable;
}

export function withDefaultConfig<T extends object>(
	config: Configuration<T> | ConfigurationGetter<T>
): ConfigurationGetter<T> {
	return function (key: keyof T, proxy: T) {
		let result: ConfigurationTypes | undefined;

		if (typeof config === "function") {
			result = config(key, proxy);
			if (!result) {
				result = defaultConfigGetter(key, proxy);
			}
		} else {
			if (Object.prototype.hasOwnProperty.call(config, key)) {
				result = config[key];
			} else {
				result = defaultConfigGetter(key, proxy);
			}
		}

		return result;
	};
}

export function getOpts<T extends ConfigurationTypes>(defaultOptions: T) {
	return function (options: Omit<T, "type">) {
		function decorator(target: any, propertyKey: string): any {
			const config = getCtorConfiguration(target.constructor);
			config[propertyKey] = Object.assign({}, defaultOptions, options);

			return undefined;
		}

		Object.assign(decorator, defaultOptions, options);

		return decorator as typeof decorator & T;
	};
}
