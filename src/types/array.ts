import Graph from "../core/graph";
import {
	getAdministration,
	getObservable,
	getObservableSource,
} from "./utils/lookup";
import { notifyArrayUpdate, notifySpliceArray } from "./utils/observe";
import Administration from "./utils/Administration";

export class ArrayAdministration<T> extends Administration<T[]> {
	constructor(source: T[] = [], graph: Graph) {
		super(source, graph);
		this.proxyTraps.get = (_, name) => this.proxyGet(name);
		this.proxyTraps.set = (_, name, value) => this.proxySet(name, value);
	}

	private proxyGet(name: string | number | symbol): unknown {
		if (name === "length") {
			return this.getArrayLength();
		}

		if (typeof name === "number") {
			return this.get(name);
		}

		if (typeof name === "string" && String(parseInt(name)) === name) {
			return this.get(parseInt(name));
		}

		if (arrayMethods.hasOwnProperty(name)) {
			return arrayMethods[name as keyof typeof arrayMethods];
		}

		return this.source[name];
	}

	private proxySet(name: string | number | symbol, value: T | number): boolean {
		if (name === "length") {
			this.setArrayLength(value as number);
		} else if (typeof name === "number") {
			this.set(name, value as T);
		} else if (typeof name === "string" && String(parseInt(name)) === name) {
			this.set(parseInt(name), value as T);
		} else {
			this.source[name] = value;
		}

		return true;
	}

	get(index: number): T | undefined {
		this.atom.reportObserved();
		return getObservable(this.source[index], this.graph);
	}

	set(index: number, newValue: T): void {
		const values = this.source;
		const targetValue = getObservableSource(newValue);

		if (index < values.length) {
			// update at index in range
			const oldValue = values[index];

			const changed = targetValue !== oldValue;
			if (changed) {
				this.graph.batch(() => {
					values[index] = targetValue;
					this.atom.reportChanged();
					notifyArrayUpdate(this.proxy, index, oldValue, targetValue);
				});
			}
		} else if (index === values.length) {
			// add a new item
			this.spliceWithArray(index, 0, [newValue]);
		} else {
			// out of bounds
			throw new Error(
				`Index out of bounds, ${index} is larger than ${values.length}`
			);
		}
	}

	getArrayLength(): number {
		this.atom.reportObserved();
		return this.source.length;
	}

	setArrayLength(newLength: number): void {
		if (typeof newLength !== "number" || newLength < 0)
			throw new Error("Out of range: " + newLength);
		const currentLength = this.source.length;
		if (newLength === currentLength) return;
		else if (newLength > currentLength) {
			const newItems = new Array(newLength - currentLength);
			for (let i = 0; i < newLength - currentLength; i++)
				newItems[i] = undefined;
			this.spliceWithArray(currentLength, 0, newItems);
		} else this.spliceWithArray(newLength, currentLength - newLength);
	}

	spliceWithArray(index: number, deleteCount?: number, newItems?: T[]): T[] {
		const length = this.source.length;
		const newTargetItems: T[] = [];

		if (newItems) {
			for (let i = 0; i < newItems.length; i++) {
				newTargetItems[i] = getObservableSource(newItems[i]);
			}
		}

		if (index === undefined) index = 0;
		else if (index > length) index = length;
		else if (index < 0) index = Math.max(0, length + index);

		if (arguments.length === 1) deleteCount = length - index;
		else if (deleteCount === undefined || deleteCount === null) deleteCount = 0;
		else deleteCount = Math.max(0, Math.min(deleteCount, length - index));

		const res = this.spliceItemsIntoValues(index, deleteCount, newTargetItems);

		if (deleteCount !== 0 || newTargetItems.length !== 0) {
			this.graph.batch(() => {
				this.atom.reportChanged();
				notifySpliceArray(this.proxy, index, newTargetItems, res);
			});
		}

		return res;
	}

	spliceItemsIntoValues(
		index: number,
		deleteCount: number,
		newItems: T[]
	): T[] {
		return this.source.splice.apply(
			this.source,
			[index, deleteCount].concat(newItems as any) as any
		);
	}
}

const arrayMethods = {
	fill<T>(
		this: T[],
		value: T,
		start?: number | undefined,
		end?: number | undefined
	): T[] {
		const adm = getAdministration(this);
		adm.source.fill(value, start, end);
		adm.atom.reportChanged();

		return this;
	},

	splice<T>(
		this: T[],
		index: number,
		deleteCount?: number,
		...newItems: T[]
	): T[] {
		const adm = getAdministration(this);
		switch (arguments.length) {
			case 0:
				return [];
			case 1:
				return adm.spliceWithArray(index);
			case 2:
				return adm.spliceWithArray(index, deleteCount);
		}
		return adm.spliceWithArray(index, deleteCount, newItems);
	},

	push<T>(this: T[], ...items: T[]): number {
		const adm = getAdministration(this);
		adm.spliceWithArray(adm.source.length, 0, items);
		return adm.source.length;
	},

	pop<T>(this: T[]): T {
		return this.splice(
			Math.max(getAdministration(this).source.length - 1, 0),
			1
		)[0];
	},

	shift<T>(this: T[]): T {
		return this.splice(0, 1)[0];
	},

	unshift<T>(this: T[], ...items: T[]): number {
		const adm = getAdministration(this);
		adm.spliceWithArray(0, 0, items);
		return adm.source.length;
	},

	reverse<T>(this: T[]): T[] {
		const adm = getAdministration(this);

		adm.source.reverse();

		adm.atom.reportChanged();

		return this;
	},

	sort<T>(this: T[], compareFn?: ((a: T, b: T) => number) | undefined): T[] {
		const adm = getAdministration(this);
		adm.atom.reportChanged();

		adm.source.sort(
			compareFn &&
				((a, b) =>
					compareFn(getObservable(a, adm.graph), getObservable(b, adm.graph)))
		);

		return this;
	},
};

[
	"concat",
	"every",
	"filter",
	"forEach",
	"map",
	"flatMap",
	"find",
	"findIndex",
	"some",
	"join",
	"toString",
	"toLocaleString",
	"slice",
	"copyWithin",
	"flat",
	"indexOf",
	"includes",
	"lastIndexOf",
	"reduce",
	"reduceRight",
].forEach((method) => {
	if (Array.prototype.hasOwnProperty(method)) {
		arrayMethods[method] = function (this: unknown[]): unknown {
			const adm = getAdministration(this);

			return adm.source[method].apply(adm.proxy, arguments);
		};
	}
});
