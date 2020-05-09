import Graph from "../graph";
import {
	getAdministration,
	getObservable,
	getObservableSource
} from "./utils/lookup";
import { notifyArrayUpdate, notifySpliceArray } from "../trace";
import Administration from "./utils/Administration";

export class ObservableArrayAdministration<T> extends Administration<T[]> {
	constructor(source: T[] = [], graph: Graph) {
		super(source, graph, arrayTraps);
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
				values[index] = targetValue;
				this.atom.reportChanged();
				notifyArrayUpdate(this.proxy, index, oldValue, targetValue);
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
			this.atom.reportChanged();
			notifySpliceArray(this.proxy, index, newTargetItems, res);
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
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			[index, deleteCount].concat(newItems as any) as any
		);
	}
}

const arrayTraps = {
	get<T>(target: T[], name: string | number | symbol, proxy: T[]): unknown {
		const adm = getAdministration(proxy);
		if (name === "length") {
			return adm.getArrayLength();
		}

		if (typeof name === "number") {
			return adm.get(name);
		}

		if (typeof name === "string" && String(parseInt(name)) === name) {
			return adm.get(parseInt(name));
		}

		if (arrayMethods.hasOwnProperty(name)) {
			return arrayMethods[name as keyof typeof arrayMethods];
		}

		return target[name];
	},
	set<T>(
		target: T[],
		name: string | number | symbol,
		value: T | number,
		proxy: T[]
	): boolean {
		const adm = getAdministration(proxy);

		if (name === "length") {
			adm.setArrayLength(value as number);
		} else if (typeof name === "number") {
			adm.set(name, value as T);
		} else if (typeof name === "string" && String(parseInt(name)) === name) {
			adm.set(parseInt(name), value as T);
		} else {
			target[name] = value;
		}

		return true;
	},
	preventExtensions(): boolean {
		throw new Error(`Observable arrays cannot be frozen`);
		return false;
	}
};

const arrayMethods = {
	concat<T>(this: T[], ...args: Array<T | T[]>): T[] {
		const adm = getAdministration(this);
		adm.atom.reportObserved();

		const targetArgs = [];
		for (let i = 0; i < args.length; i++) {
			if (Array.isArray(args[i])) {
				const arg = args[i] as T[];
				const targetInnerArgs = [];
				for (let j = 0; j < arg.length; j++) {
					targetInnerArgs[j] = getObservableSource(arg[j]);
				}
				targetArgs[i] = targetInnerArgs;
			} else {
				targetArgs[i] = getObservableSource(args[i]);
			}
		}

		return getObservable(adm.source.concat(...targetArgs), adm.graph);
	},
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

		adm.source.sort(compareFn);

		return this;
	}
};

// methods that do not accept observable input and do not produce observable output
["join", "toString", "toLocaleString"].forEach(method => {
	if (Array.prototype.hasOwnProperty(method)) {
		arrayMethods[method] = function(this: unknown[]): string {
			const adm = getAdministration(this);
			adm.atom.reportObserved();
			return adm.source[method].apply(adm.source, arguments);
		};
	}
});

// search methods
["indexOf", "includes", "lastIndexOf"].forEach(method => {
	if (Array.prototype.hasOwnProperty(method)) {
		arrayMethods[method] = function(
			this: unknown[],
			value: unknown,
			...args: unknown[]
		): unknown {
			const adm = getAdministration(this);
			adm.atom.reportObserved();
			const target = getObservableSource(value);
			return adm.source[method].call(adm.source, target, ...args);
		};
	}
});

// methods that return a new array
["slice", "copyWithin", "flat"].forEach(method => {
	if (Array.prototype.hasOwnProperty(method)) {
		arrayMethods[method] = function(this: unknown[]): unknown[] {
			const adm = getAdministration(this);
			adm.atom.reportObserved();
			return getObservable(
				adm.source[method].apply(adm.source, arguments),
				adm.graph
			);
		};
	}
});

// Methods that loop through the array
[
	"every",
	"filter",
	"forEach",
	"map",
	"flatMap",
	"find",
	"findIndex",
	"some"
].forEach(method => {
	if (Array.prototype.hasOwnProperty(method)) {
		arrayMethods[method] = function(
			this: unknown[],
			func: (value: unknown, index: number, arr: unknown[]) => unknown,
			context: unknown
		): unknown[] {
			const adm = getAdministration(this);
			adm.atom.reportObserved();
			return adm.source[method](function(v: unknown, i: number) {
				return func.call(context, getObservable(v, adm.graph), i, adm.proxy);
			});
		};
	}
});

// reduce methods
["reduce", "reduceRight"].forEach(method => {
	if (Array.prototype.hasOwnProperty(method)) {
		arrayMethods[method] = function(
			this: unknown[],
			func: (
				acc: unknown,
				value: unknown,
				index: number,
				arr: unknown[]
			) => unknown,
			initialvalue: unknown
		): unknown {
			const adm = getAdministration(this);
			adm.atom.reportObserved();
			return adm.source[method](function(
				acc: unknown,
				value: unknown,
				index: number
			) {
				return getObservable(
					func.call(
						adm.proxy,
						acc,
						getObservable(value, adm.graph),
						index,
						adm.proxy
					),
					adm.graph
				);
			},
			initialvalue);
		};
	}
});
