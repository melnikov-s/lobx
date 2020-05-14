import Graph from "../../graph";
import { ObservableMapAdministration } from "../map";
import { ObservableSetAdministration } from "../set";
import { ObservableObjectAdministration, propertyType } from "../object";
import { ObservableArrayAdministration } from "../array";
import { ObservableDateAdministration } from "../date";
import Administration, { getAdministration as getAdm } from "./Administration";
import {
	ObservablePromiseAdministration,
	ObservablePromiseConstructorAdministration
} from "../promise";
import { getGlobal } from "../../../utils";

export function getAdministration<T extends object>(
	obj: T
): T extends Set<infer S>
	? ObservableSetAdministration<S>
	: T extends Map<infer K, infer V>
	? ObservableMapAdministration<K, V>
	: T extends Array<infer R>
	? ObservableArrayAdministration<R>
	: T extends Date
	? ObservableDateAdministration
	: T extends Promise<unknown>
	? ObservablePromiseAdministration
	: T extends typeof Promise
	? ObservablePromiseConstructorAdministration // eslint-disable-next-line @typescript-eslint/no-explicit-any
	: ObservableObjectAdministration<any> {
	return getAdm(obj)! as ReturnType<typeof getAdministration>;
}

const actionsMap: WeakMap<Function, Function> = new WeakMap();

export function getObservableSource<T>(obj: T): T {
	const adm = getAdm(obj);

	return adm ? ((adm.source as unknown) as T) : obj;
}

const observablePromiseMap: WeakMap<Graph, typeof Promise> = new WeakMap();

function getObservablePromiseCtor(graph: Graph): typeof Promise {
	let ObservablePromise = observablePromiseMap.get(graph);
	if (!ObservablePromise) {
		ObservablePromise = new ObservablePromiseConstructorAdministration(
			Promise,
			graph,
			true
		).proxy;
		observablePromiseMap.set(graph, ObservablePromise);
	}

	return ObservablePromise;
}

export function patchPromise<T>(fn: () => T, graph: Graph): T {
	const global = getGlobal();
	const oldPromise: typeof Promise = global.Promise;
	const ObservablePromise = getObservablePromiseCtor(graph);
	if (oldPromise === ObservablePromise) {
		throw new Error("uh oh");
	}
	global.Promise = ObservablePromise;
	try {
		return fn();
	} finally {
		if (global.Promise !== ObservablePromise) {
			throw new Error(
				"lobx: Fatal error! promise got overwritten during async action"
			);
		}
		global.Promise = oldPromise;
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
	config: Partial<Record<keyof T, keyof typeof propertyType>>,
	target: T,
	graph: Graph
): T {
	if (getAdm(target)) {
		throw new Error(
			"lobx: can't re-configure an observable that's already been observed"
		);
	}

	const adm = new ObservableObjectAdministration(target, graph, config as any);
	return adm.proxy;
}

export function getObservable<T>(value: T, graph: Graph): T {
	const adm = getAdm(value);

	if (adm) {
		if (adm.graph !== graph) {
			throw new Error("lobx: observables can only exists on a single graph");
		}

		return (adm.proxy as unknown) as T;
	}

	if (!value) {
		return value;
	}

	if (typeof value === "object" || typeof value === "function") {
		const obj = (value as unknown) as object;

		let Adm: new (
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			obj: any,
			graph: Graph
		) => Administration = ObservableObjectAdministration;

		if (Array.isArray(obj)) {
			Adm = ObservableArrayAdministration;
		} else if (obj instanceof Map || obj instanceof WeakMap) {
			Adm = ObservableMapAdministration;
		} else if (obj instanceof Set || obj instanceof WeakSet) {
			Adm = ObservableSetAdministration;
		} else if (obj instanceof Date) {
			Adm = ObservableDateAdministration;
		} else if (typeof obj === "object") {
			const proto = Object.getPrototypeOf(obj);
			if (
				proto &&
				new Set([Number, Boolean, String, Error, Promise, RegExp]).has(
					proto.constructor
				)
			)
				return value;
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
