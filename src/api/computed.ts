import ComputedNode from "../core/nodes/computed";
import { propertyType } from "../types/object";
import { getCtorConfiguration } from "../types/utils/lookup";
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

		const config = getCtorConfiguration(target.constructor);
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

function computedWithOptions(
	options: Omit<ObjectComputedOptions, "type">
): ((target: any, propertyKey: string) => any) & typeof propertyType.computed {
	function decorator(target: any, propertyKey: string): any {
		const config = getCtorConfiguration(target.constructor);
		config[propertyKey] = Object.assign({}, propertyType.computed, options);

		return undefined;
	}
	Object.assign(decorator, propertyType.computed, options);

	return decorator as typeof decorator & typeof propertyType.computed;
}

Object.assign(computed, propertyType.computed);

computed.withOptions = computedWithOptions;

export default computed as typeof computed & {
	withOptions: typeof computedWithOptions;
} & typeof propertyType.computed;
