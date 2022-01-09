import { propertyType, getOpts } from "../types/utils/configuration";
import { getCtorConfiguration } from "../types/utils/lookup";
import { isPropertyKey } from "../utils";
import { runInAction } from "./graph";

function action<T extends unknown[], U>(
	func: (...args: T) => U
): (...args: T) => U;

function action(
	target: unknown,
	propertyKey: string,
	descriptor: PropertyDescriptor
): any;

function action<T extends unknown[], U>(...args: unknown[]): unknown {
	if (isPropertyKey(args[1])) {
		const [target, propertyKey, descriptor] = args as [
			any,
			PropertyKey,
			unknown
		];

		const config = getCtorConfiguration(target.constructor);
		config[propertyKey] = propertyType.action;
		return descriptor;
	} else {
		const [func] = args as [(...args: T) => U];
		return function (this: unknown, ...args: T): U {
			return runInAction(() => func.apply(this, args)) as U;
		};
	}
}

Object.assign(action, propertyType.action);
action.opts = getOpts(propertyType.action);

export default action as typeof action & typeof propertyType.action;
