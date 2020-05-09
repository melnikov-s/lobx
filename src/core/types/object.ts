import Atom from "../nodes/atom";
import Graph from "../graph";
import {
	getAdministration,
	getObservable,
	getObservableSource
} from "./utils/lookup";
import { notifyUpdate, notifyAdd, notifyDelete } from "../trace";
import { isPropertyKey } from "../../utils";
import Administration from "./utils/Administration";
import AtomMap from "./utils/AtomMap";

export class ObservableObjectAdministration<
	T extends object
> extends Administration<T> {
	keysAtom: Atom;
	hasMap: AtomMap<PropertyKey>;
	values: AtomMap<PropertyKey>;

	constructor(source: T = {} as T, graph: Graph) {
		super(source, graph, objectProxyTraps);
		this.keysAtom = new Atom(graph);
		this.hasMap = new AtomMap(graph);
		this.values = new AtomMap(graph);
	}

	read(key: keyof T): void {
		if (this.source.hasOwnProperty(key)) {
			this.values.reportObserved(key);
		} else if (this.graph.isTracking()) {
			this.hasMap.reportObserved(key);
		}

		this.atom.reportObserved();
	}

	write(key: keyof T, newValue: T[keyof T]): void {
		const had = this.source.hasOwnProperty(key);
		const oldValue: T[keyof T] = this.source[key];
		const targetValue = getObservableSource(newValue);

		if (!had || oldValue !== targetValue) {
			this.source[key] = targetValue;

			this.graph.runAction(() => {
				if (!had) {
					this.keysAtom.reportChanged();
					this.hasMap.reportChanged(key);
				}

				this.values.reportChanged(key);
				this.flushChange();
			});

			had
				? notifyUpdate(this.proxy, targetValue, oldValue, key)
				: notifyAdd(this.proxy, targetValue, key);
		}
	}

	has(key: PropertyKey): boolean {
		if (this.graph.isTracking()) {
			this.hasMap.reportObserved(key);
			this.atom.reportObserved();
		}

		return key in this.source;
	}

	remove(key: keyof T): void {
		if (!this.source.hasOwnProperty(key)) return;

		const oldValue = this.source[key];
		delete this.source[key];
		this.graph.runAction(() => {
			this.values.reportChanged(key);
			this.keysAtom.reportChanged();
			this.values.delete(key);
			this.hasMap.reportChanged(key);
			this.flushChange();
		});

		notifyDelete(this.proxy, oldValue, key);
	}

	getKeys(): PropertyKey[] {
		this.keysAtom.reportObserved();
		return Object.keys(this.source);
	}
}

const objectProxyTraps: ProxyHandler<object> = {
	has<T extends object>(target: T, name: PropertyKey) {
		if (name === "constructor") return true;
		const adm = getAdministration(target);

		if (isPropertyKey(name)) return adm.has(name);
		return name in target;
	},
	get<T extends object>(target: T, name: keyof T) {
		if (name === "constructor") return target[name];
		const adm = getAdministration(target);

		if (isPropertyKey(name)) adm.read(name);

		return getObservable(target[name], adm.graph);
	},
	set<T extends object>(target: T, name: keyof T, value: T[keyof T]) {
		if (!isPropertyKey(name)) return false;

		const adm = getAdministration(target);

		adm.write(name, value);

		return true;
	},
	deleteProperty<T extends object>(target: T, name: keyof T) {
		if (!isPropertyKey(name)) return false;
		const adm = getAdministration(target);
		adm.remove(name);
		return true;
	},
	ownKeys<T extends object>(target: T) {
		const adm = getAdministration(target);
		adm.keysAtom.reportObserved();
		return Reflect.ownKeys(target);
	},
	preventExtensions(): boolean {
		throw new Error(`Dynamic observable objects cannot be frozen`);
		return false;
	}
};
