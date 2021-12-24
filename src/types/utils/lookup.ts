import Graph from "../../core/graph";
import { MapAdministration } from "../map";
import { SetAdministration } from "../set";
import { ObjectAdministration } from "../object";
import {
	ActionOptions,
	Configuration,
	ConfigurationGetter,
} from "./configuration";
import { ArrayAdministration } from "../array";
import { DateAdministration } from "../date";
import Administration, { getAdministration as getAdm } from "./Administration";
import { getParentConstructor, isPlainObject } from "../../utils";

export function getAdministration<T extends object>(
	obj: T
): T extends Set<infer S>
	? SetAdministration<S>
	: T extends Map<infer K, infer V>
	? MapAdministration<K, V>
	: T extends Array<infer R>
	? ArrayAdministration<R>
	: T extends Date
	? DateAdministration
	: ObjectAdministration<any> {
	return getAdm(obj)! as ReturnType<typeof getAdministration>;
}

const actionsMap: WeakMap<Function, Function> = new WeakMap();
const constructorConfigMap: WeakMap<Function, Configuration<unknown> | null> =
	new WeakMap();

export function getCtorConfiguration(Ctor: Function): Configuration<unknown> {
	let config = constructorConfigMap.get(Ctor);
	if (!config) {
		config = setCtorConfiguration(Ctor, {});
	}

	return config;
}

export function hasCtorConfiguration(Ctor: Function): boolean {
	return constructorConfigMap.has(Ctor);
}

export function setCtorAutoConfigure(Ctor: Function): void {
	constructorConfigMap.set(Ctor, null);
}

export function setCtorConfiguration<T>(
	Ctor: Function,
	config: Configuration<T> | ConfigurationGetter<T>
): Configuration<T> {
	if (constructorConfigMap.has(Ctor)) {
		throw new Error(
			`lobx: Constructor '${Ctor.name}' has already been decorated`
		);
	}

	if (typeof config === "function") {
		throw new Error(
			"function configuration not supported on constructors/classes"
		);
	}
	let finalConfig = config!;
	let constructor = Ctor as Function | undefined;
	while ((constructor = getParentConstructor(constructor))) {
		const config = constructorConfigMap.get(constructor);
		if (config) {
			finalConfig = { ...config, ...finalConfig };
		}
	}

	constructorConfigMap.set(Ctor, finalConfig);

	return finalConfig;
}

export function getObservableSource<T>(obj: T): T {
	const adm = getAdm(obj);

	return adm ? (adm.source as unknown as T) : obj;
}

export function getAction<T extends Function>(
	fn: T,
	graph: Graph,
	options: ActionOptions,
	context: unknown
): T {
	let action = actionsMap.get(fn);
	const bound = options.bound;

	if (!action) {
		action = function (this: unknown, ...args: unknown[]): unknown {
			if (new.target) {
				return new (fn as any)(...args);
			}

			return graph.runInAction(
				() => fn.apply(bound ? context : this, args),
				options.untracked
			);
		};

		actionsMap.set(fn, action);
	}

	return action as T;
}

export function getObservableWithConfig<T extends object>(
	target: T,
	graph: Graph,
	config: Configuration<T> | ConfigurationGetter<T>
): T {
	if (getAdm(target)) {
		throw new Error(
			"can't re-configure an observable that's already been observed"
		);
	}

	const adm = new ObjectAdministration(target, graph, config);
	return adm.proxy;
}

export function getObservable<T>(
	value: T,
	graph: Graph,
	config?: Configuration<T>
): T {
	const adm = getAdm(value);

	if (adm) {
		if (adm.graph !== graph) {
			throw new Error("observables can only exists on a single graph");
		}

		return adm.proxy as unknown as T;
	}

	if (!value) {
		return value;
	}

	if (
		(typeof value === "object" || typeof value === "function") &&
		!Object.isFrozen(value)
	) {
		const obj = value as unknown as object;

		if (config) {
			return getObservableWithConfig(obj, graph, config) as unknown as T;
		}

		let Adm: new (obj: any, graph: Graph) => Administration =
			ObjectAdministration;

		if (Array.isArray(obj)) {
			Adm = ArrayAdministration;
		} else if (obj instanceof Map || obj instanceof WeakMap) {
			Adm = MapAdministration;
		} else if (obj instanceof Set || obj instanceof WeakSet) {
			Adm = SetAdministration;
		} else if (obj instanceof Date) {
			Adm = DateAdministration;
		} else if (typeof obj === "object") {
			const proto = Object.getPrototypeOf(obj);

			if (constructorConfigMap.has(proto?.constructor)) {
				const config = constructorConfigMap.get(proto?.constructor);

				if (config) {
					return getObservableWithConfig(
						obj,
						graph,
						constructorConfigMap.get(proto?.constructor)!
					) as unknown as T;
				}
			} else if (!isPlainObject(value)) {
				return value;
			}
		}

		const adm = new Adm(obj, graph);
		return adm.proxy as unknown as T;
	}

	return value;
}

export function isObservable(obj: unknown): boolean {
	const adm = getAdm(obj);
	return !!(adm && adm.proxy === obj);
}
