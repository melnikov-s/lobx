import Atom from "../nodes/atom";
import Graph from "../graph";
import { ObservableMapAdministration } from "./map";
import { ObservableSetAdministration } from "./set";
import { ObservableObjectAdministration } from "./object";
import { ObservableArrayAdministration } from "./array";
import { isNonPrimitive } from "../../utils";

export interface Administration<T extends object = object> {
	proxy: T;
	source: T;
	graph: Graph;
}

const baseToObservableMap: WeakMap<object, unknown> = new WeakMap();
const observableToBaseMap: WeakMap<object, unknown> = new WeakMap();
const administrationMap: WeakMap<object, Administration> = new WeakMap();

export function getAdministration<T extends object>(
	obj: T
): T extends Set<infer S>
	? ObservableSetAdministration<S>
	: T extends Map<infer K, infer V>
	? ObservableMapAdministration<K, V>
	: T extends Array<infer R>
	? ObservableArrayAdministration<R> // eslint-disable-next-line @typescript-eslint/no-explicit-any
	: ObservableObjectAdministration<any> {
	return administrationMap.get(obj)! as ReturnType<typeof getAdministration>;
}

export function linkAdministration<T extends object>(
	obj: T,
	adm: Administration
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

			let Adm: new (
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				obj: any,
				graph: Graph
			) => Administration = ObservableObjectAdministration;

			if (Array.isArray(obj)) {
				Adm = ObservableArrayAdministration;
			} else if (obj instanceof Map) {
				Adm = ObservableMapAdministration;
			} else if (obj instanceof Set) {
				Adm = ObservableSetAdministration;
			}

			const adm = new Adm(obj, graph);
			baseToObservableMap.set(obj, adm.proxy);
			observableToBaseMap.set(adm.proxy, obj);
			return (adm.proxy as unknown) as T;
		}
		default:
			return value;
	}
}

export function isObservable(obj: unknown): boolean {
	return observableToBaseMap.has(obj as object);
}

export class AtomMap<K> {
	private map: Map<unknown, Atom> | undefined;
	private weakMap: WeakMap<object, Atom> | undefined;
	private graph: Graph;

	constructor(graph: Graph) {
		this.graph = graph;
	}

	get(key: unknown): Atom | undefined {
		return isNonPrimitive(key) ? this.weakMap?.get(key) : this.map?.get(key);
	}

	delete(key: K): void {
		isNonPrimitive(key) ? this.weakMap?.delete(key) : this.map?.delete(key);
	}

	reportObserved(key: K): void {
		let entry: Atom | undefined = this.get(key);

		if (!entry) {
			if (isNonPrimitive(key)) {
				this.weakMap = this.weakMap ?? new WeakMap();

				entry = new Atom(this.graph);

				this.weakMap.set(key, entry);
			} else {
				this.map = this.map ?? new Map();

				entry = new Atom(this.graph, undefined, () => this.map?.delete(key));

				this.map.set(key, entry);
			}
		}

		entry.reportObserved();
	}

	reportChanged(key: K): void {
		return this.get(key)?.reportChanged();
	}
}
