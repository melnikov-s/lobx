import Atom from "../nodes/atom";
import Graph from "../graph";
import { ObservableMap } from "./map";
import { ObservableSet } from "./set";
import { ObservableObjectAdministration } from "./object";
import { ObservableArrayAdministration } from "./array";
import { isNonPrimitive } from "../../utils";

const baseToObservableMap: WeakMap<object, unknown> = new WeakMap();
const observableToBaseMap: WeakMap<object, unknown> = new WeakMap();
const administrationMap: WeakMap<
	object,
	| ObservableObjectAdministration<object>
	| ObservableArrayAdministration<unknown>
> = new WeakMap();

export function getAdm<T extends object>(
	obj: T
): T extends Array<infer R>
	? ObservableArrayAdministration<R> // eslint-disable-next-line @typescript-eslint/no-explicit-any
	: ObservableObjectAdministration<any> {
	return administrationMap.get(obj)! as ReturnType<typeof getAdm>;
}

export function linkAdm<T extends object>(
	obj: T,
	adm:
		| ObservableObjectAdministration<object>
		| ObservableArrayAdministration<unknown>
): void {
	administrationMap.set(obj, adm);
}

export function getObservableSource<T>(observable: T): T {
	return (observableToBaseMap.get((observable as unknown) as object) ??
		observable) as T;
}

export function getObservable<T>(value: T, graph: Graph): T {
	// TODO: ensure that they come from the same graph
	if (baseToObservableMap.has((value as unknown) as object)) {
		return baseToObservableMap.get((value as unknown) as object) as T;
	}

	if (!value) {
		return value;
	}

	switch (typeof value) {
		case "function":
		case "object": {
			const obj = (value as unknown) as object;

			if (isObservable(obj)) {
				return value;
			}

			if (Array.isArray(obj)) {
				const adm = new ObservableArrayAdministration(obj, graph);
				baseToObservableMap.set(obj, adm.proxy);
				observableToBaseMap.set(adm.proxy, obj);
				return (adm.proxy as unknown) as T;
			}

			if (obj instanceof Map) {
				const o = new ObservableMap(obj, graph);
				baseToObservableMap.set(obj, o);
				observableToBaseMap.set(o, obj);

				return (o as unknown) as T;
			}

			if (obj instanceof Set) {
				const o = new ObservableSet(obj, graph);
				baseToObservableMap.set(obj, o);
				observableToBaseMap.set(o, obj);

				return (o as unknown) as T;
			}

			const adm = new ObservableObjectAdministration(obj, graph);
			baseToObservableMap.set(obj, adm.proxy);
			observableToBaseMap.set(adm.proxy, obj);
			return (adm.proxy as unknown) as T;
		}
		default:
			return value;
	}
}

export function isObservableMap(
	obj: unknown
): obj is ObservableMap<unknown, unknown> {
	return obj instanceof ObservableMap;
}

export function isObservableObject(obj: unknown): obj is object {
	return (
		obj && typeof obj === "object" && observableToBaseMap.has(obj as object)
	);
}

export function isObservableArray(obj: unknown): obj is Array<unknown> {
	return Array.isArray(obj) && observableToBaseMap.has(obj);
}

export function isObservableSet(obj: unknown): obj is ObservableSet<unknown> {
	return obj instanceof ObservableSet;
}

export function isObservable(obj: unknown): boolean {
	return (
		isObservableMap(obj) ||
		isObservableSet(obj) ||
		isObservableObject(obj) ||
		isObservableArray(obj)
	);
}

export class AtomMap<K> {
	private _map: Map<unknown, Atom> | undefined;
	private _weakMap: WeakMap<object, Atom> | undefined;
	private _graph: Graph;

	constructor(graph: Graph) {
		this._graph = graph;
	}

	private get(key: unknown): Atom | undefined {
		return isNonPrimitive(key) ? this._weakMap?.get(key) : this._map?.get(key);
	}

	delete(key: K): void {
		isNonPrimitive(key) ? this._weakMap?.delete(key) : this._map?.delete(key);
	}

	reportObserved(key: K): void {
		let entry: Atom | undefined = this.get(key);

		if (!entry) {
			if (isNonPrimitive(key)) {
				this._weakMap = this._weakMap ?? new WeakMap();

				entry = new Atom(this._graph);

				this._weakMap.set(key, entry);
			} else {
				this._map = this._map ?? new Map();

				entry = new Atom(this._graph, undefined, () => this._map?.delete(key));

				this._map.set(key, entry);
			}
		}

		entry.reportObserved();
	}

	reportChanged(key: K): void {
		return this.get(key)?.reportChanged();
	}
}
