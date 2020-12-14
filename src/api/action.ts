import { propertyType } from "../types/object";
import { getObservableConfiguration } from "../types/utils/lookup";
import { isPropertyKey } from "../utils";
import { runInAction } from "./graph";

export default function action<T extends unknown[], U>(
	func: (...args: T) => U
): (...args: T) => U;

export default function action(
	target: unknown,
	propertyKey: string,
	descriptor: PropertyDescriptor
): any;

export default function action<T extends unknown[], U>(
	...args: unknown[]
): unknown {
	if (isPropertyKey(args[1])) {
		const [target, propertyKey, descriptor] = args as [
			any,
			PropertyKey,
			unknown
		];

		const config = getObservableConfiguration(target.constructor);
		config[propertyKey] = propertyType.action;
		return descriptor;
	} else {
		const [func] = args as [(...args: T) => U];
		return function(this: unknown, ...args: T): U {
			return runInAction(() => func.apply(this, args)) as U;
		};
	}
}
