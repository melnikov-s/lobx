import Atom from "../nodes/atom";
import Graph from "../graph";
import {
	getAdm,
	linkAdm,
	AtomMap,
	getObservable,
	getObservableSource
} from "./utils";
import { notifyUpdate, notifyAdd, notifyDelete } from "../trace";

export class ObservableObjectAdministration<T extends object> {
	keysAtom: Atom;
	hasMap: AtomMap<PropertyKey>;
	values: AtomMap<PropertyKey>;
	target: T;
	proxy: T;
	graph: Graph;

	constructor(target: T | undefined, graph: Graph) {
		this.target = target || ({} as T);
		linkAdm(this.target, this);
		this.proxy = new Proxy(this.target, objectProxyTraps) as T;
		this.keysAtom = new Atom(graph);
		this.hasMap = new AtomMap(graph);
		this.values = new AtomMap(graph);
		this.graph = graph;
	}

	read(key: keyof T): void {
		if (this.target.hasOwnProperty(key)) {
			this.values.reportObserved(key);
		} else if (this.graph.isTracking()) {
			this.hasMap.reportObserved(key);
		}
	}

	write(key: keyof T, newValue: T[keyof T]): void {
		const had = this.target.hasOwnProperty(key);
		const oldValue: T[keyof T] = this.target[key];
		const targetValue = getObservableSource(newValue);

		if (!had || oldValue !== targetValue) {
			this.target[key] = targetValue;

			this.graph.runAction(() => {
				if (!had) {
					this.keysAtom.reportChanged();
					this.hasMap.reportChanged(key);
				}

				this.values.reportChanged(key);
			});

			had
				? notifyUpdate(this.proxy, targetValue, oldValue, key)
				: notifyAdd(this.proxy, targetValue, key);
		}
	}

	has(key: PropertyKey): boolean {
		if (this.graph.isTracking()) {
			this.hasMap.reportObserved(key);
		}

		return key in this.target;
	}

	remove(key: keyof T): void {
		if (!this.target.hasOwnProperty(key)) return;

		const oldValue = this.target[key];
		delete this.target[key];
		this.graph.runAction(() => {
			this.values.reportChanged(key);
			this.keysAtom.reportChanged();
			this.values.delete(key);
			this.hasMap.reportChanged(key);
		});

		notifyDelete(this.proxy, oldValue, key);
	}

	getKeys(): PropertyKey[] {
		this.keysAtom.reportObserved();
		return Object.keys(this.target);
	}
}

function isPropertyKey(val: PropertyKey): boolean {
	return (
		typeof val === "string" ||
		typeof val === "number" ||
		typeof val === "symbol"
	);
}

const objectProxyTraps: ProxyHandler<object> = {
	has<T extends object>(target: T, name: PropertyKey) {
		if (name === "constructor") return true;
		const adm = getAdm(target);

		if (isPropertyKey(name)) return adm.has(name);
		return name in target;
	},
	get<T extends object>(target: T, name: keyof T) {
		if (name === "constructor") return target[name];
		const adm = getAdm(target);

		if (isPropertyKey(name)) adm.read(name);

		return getObservable(target[name], adm.graph);
	},
	set<T extends object>(target: T, name: keyof T, value: T[keyof T]) {
		if (!isPropertyKey(name)) return false;

		const adm = getAdm(target);

		adm.write(name, value);

		return true;
	},
	deleteProperty<T extends object>(target: T, name: keyof T) {
		if (!isPropertyKey(name)) return false;
		const adm = getAdm(target);
		adm.remove(name);
		return true;
	},
	ownKeys<T extends object>(target: T) {
		const adm = getAdm(target);
		adm.keysAtom.reportObserved();
		return Reflect.ownKeys(target);
	},
	preventExtensions(): boolean {
		throw new Error(`Dynamic observable objects cannot be frozen`);
		return false;
	}
};
