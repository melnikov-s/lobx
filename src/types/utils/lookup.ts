import Graph from "../../core/graph";
import { MapAdministration } from "../map";
import { SetAdministration } from "../set";
import {
	ObjectAdministration,
	Configuration,
	ConfigurationGetter
} from "../object";
import { ArrayAdministration } from "../array";
import { DateAdministration } from "../date";
import Administration, { getAdministration as getAdm } from "./Administration";
import { PromiseAdministration, PromiseCtorAdministration } from "../promise";
import { getGlobal, getParentConstructor, isPlainObject } from "../../utils";

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
	: T extends Promise<unknown>
	? PromiseAdministration
	: T extends typeof Promise
	? PromiseCtorAdministration
	: ObjectAdministration<any> {
	return getAdm(obj)! as ReturnType<typeof getAdministration>;
}

const actionsMap: WeakMap<Function, Function> = new WeakMap();
const constructorConfigMap: WeakMap<
	Function,
	Configuration<unknown> | null
> = new WeakMap();

export function getObservableSource<T>(obj: T): T {
	const adm = getAdm(obj);

	return adm ? ((adm.source as unknown) as T) : obj;
}

const observablePromiseMap: WeakMap<Graph, typeof Promise> = new WeakMap();
const asyncGraphActions: WeakSet<Graph> = new WeakSet();

function getObservablePromiseCtor(graph: Graph): typeof Promise {
	let ObservablePromise = observablePromiseMap.get(graph);
	if (!ObservablePromise) {
		ObservablePromise = new PromiseCtorAdministration(Promise, graph, true)
			.proxy;
		observablePromiseMap.set(graph, ObservablePromise);
	}

	return ObservablePromise;
}

export function patchPromise<T>(fn: () => T, graph: Graph): T {
	// if we're already in an async action
	if (asyncGraphActions.has(graph)) {
		return fn();
	}

	const global = getGlobal();
	const oldPromise: typeof Promise = global.Promise;
	const ObservablePromise = getObservablePromiseCtor(graph);
	global.Promise = ObservablePromise;
	asyncGraphActions.add(graph);
	try {
		return fn();
	} finally {
		if (global.Promise !== ObservablePromise) {
			throw new Error(
				"Fatal error! promise got overwritten during async action"
			);
		}
		global.Promise = oldPromise;
		asyncGraphActions.delete(graph);
	}
}

export function getAction<T extends Function>(
	fn: T,
	graph: Graph,
	async: boolean = false
): T {
	let action = actionsMap.get(fn);

	if (!action) {
		action = async
			? function(this: unknown, ...args: unknown[]): unknown {
					return patchPromise(
						() => graph.runInAction(() => fn.apply(this, args)),
						graph
					);
			  }
			: function(this: unknown, ...args: unknown[]): unknown {
					return graph.runInAction(() => fn.apply(this, args));
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

	let finalConfig:
		| Configuration<T>
		| ConfigurationGetter<T>
		| undefined = config;

	if (typeof target === "function" && !constructorConfigMap.has(target)) {
		if (typeof finalConfig === "function") {
			throw new Error(
				"function configuration not supported on constructors/classes"
			);
		}
		finalConfig = config!;
		let constructor = target as Function | undefined;
		while ((constructor = getParentConstructor(constructor))) {
			const config = constructorConfigMap.get(constructor);
			if (config) {
				finalConfig = { ...config, ...finalConfig };
			}
		}

		constructorConfigMap.set(target, finalConfig);
		finalConfig = undefined; // config is for instances not for ctor
	}

	const adm = new ObjectAdministration(target, graph, finalConfig as any);
	return adm.proxy;
}

export function getObservable<T>(
	value: T,
	graph: Graph,
	config?: Configuration<T>,
	observeNonPlain: boolean = false
): T {
	const adm = getAdm(value);

	if (adm) {
		if (adm.graph !== graph) {
			throw new Error("observables can only exists on a single graph");
		}

		return (adm.proxy as unknown) as T;
	}

	if (!value) {
		return value;
	}

	if (
		(typeof value === "object" || typeof value === "function") &&
		!Object.isFrozen(value)
	) {
		const obj = (value as unknown) as object;

		if (config) {
			return (getObservableWithConfig(obj, graph, config) as unknown) as T;
		}

		let Adm: new (
			obj: any,
			graph: Graph
		) => Administration = ObjectAdministration;

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
					return (getObservableWithConfig(
						obj,
						graph,
						constructorConfigMap.get(proto?.constructor)!
					) as unknown) as T;
				}
			} else if (!isPlainObject(value) && !observeNonPlain) {
				return value;
			}
		} else if (typeof obj === "function") {
			// allow the observation of non plain objects if their constructor was passed
			// into observable
			constructorConfigMap.set(obj, null);
		}

		const adm = new Adm(obj, graph);
		return (adm.proxy as unknown) as T;
	}

	return value;
}

export function isObservable(obj: unknown): boolean {
	const adm = getAdm(obj);
	return !!(adm && adm.proxy === obj);
}
