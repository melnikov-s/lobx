import ComputedNode from "../core/nodes/computed";
import { propertyType } from "../types/object";
import { getObservableConfiguration } from "../types/utils/lookup";
import { isPropertyKey } from "../utils";
import { resolveGraph, Graph } from "./graph";
import { ComputedOptions as ObjectComputedOptions } from "../types/object";

export type Computed<T> = {
	clear: () => void;
	equals: (value: T) => boolean;
	isDirty: () => boolean;
	isKeepAlive: () => boolean;
	get: () => T;
	setKeepAlive: (keepAlive: boolean) => void;
};

export type ComputedOptions<T> = {
	graph?: Graph;
	equals?: (a: T, b: T) => boolean;
	keepAlive?: boolean;
	context?: unknown;
};

function computed<T>(fn: () => T, opts?: ComputedOptions<T>): ComputedNode<T>;

function computed(
	target: unknown,
	propertyKey: string,
	descriptor: PropertyDescriptor
): any;

function computed<T>(...args: unknown[]): unknown {
	if (isPropertyKey(args[1])) {
		const [target, propertyKey, descriptor] = args as [
			any,
			PropertyKey,
			unknown
		];

		const config = getObservableConfiguration(target.constructor);
		config[propertyKey] = propertyType.computed;
		return descriptor;
	} else {
		const [fn, opts] = args as [() => T, ComputedOptions<T>];
		return new ComputedNode(
			resolveGraph(opts?.graph),
			fn,
			opts?.equals,
			opts?.keepAlive,
			opts?.context
		);
	}
}

function computedWithOptions(options: Omit<ObjectComputedOptions, "type">) {
	return (target: any, propertyKey: string): any => {
		const config = getObservableConfiguration(target.constructor);
		config[propertyKey] = propertyType.computed(options);

		return undefined;
	};
}

computed.withOptions = computedWithOptions;

export default computed as typeof computed & {
	withOptions: typeof computedWithOptions;
};
