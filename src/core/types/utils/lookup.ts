import Graph from "../../graph";
import { ObservableMapAdministration } from "../map";
import { ObservableSetAdministration } from "../set";
import { ObservableObjectAdministration } from "../object";
import { ObservableArrayAdministration } from "../array";
import Administration, { getAdministration as getAdm } from "./Administration";

export function getAdministration<T extends object>(
	obj: T
): T extends Set<infer S>
	? ObservableSetAdministration<S>
	: T extends Map<infer K, infer V>
	? ObservableMapAdministration<K, V>
	: T extends Array<infer R>
	? ObservableArrayAdministration<R> // eslint-disable-next-line @typescript-eslint/no-explicit-any
	: ObservableObjectAdministration<any> {
	return getAdm(obj)! as ReturnType<typeof getAdministration>;
}

export function getObservableSource<T>(obj: T): T {
	const adm = getAdm(obj);

	return adm ? ((adm.source as unknown) as T) : obj;
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

	switch (typeof value) {
		case "function":
		case "object": {
			const obj = (value as unknown) as object;

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
			return (adm.proxy as unknown) as T;
		}
		default:
			return value;
	}
}

export function isObservable(obj: unknown): boolean {
	const adm = getAdm(obj);
	return !!(adm && adm.proxy === obj);
}
