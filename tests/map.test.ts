import {
	autorun,
	observable,
	isObservable,
	reaction,
	trace
} from "../src/index";
import { getAdministration } from "../src/core/types/utils/lookup";

/* eslint-disable @typescript-eslint/no-unused-vars */

const map = <K = any, V = any>(obj: Map<K, V> = new Map()): Map<K, V> => {
	return observable(obj);
};

const weakMap = <K extends object = any, V = any>(
	obj: WeakMap<K, V> = new WeakMap()
): WeakMap<K, V> => {
	return observable(obj);
};

const keys = (map: Map<any, any>): any[] => {
	return Array.from(map.keys());
};

const values = (map: Map<any, any>): any[] => {
	return keys(map).map(key => map.get(key));
};

test("map values are deeply observable", () => {
	const o = { prop: "value" };
	const m = map();
	let count = 0;
	m.set(o, o);
	expect(isObservable(m.get(o))).toBe(true);

	autorun(() => {
		m.get(o).prop;
		count++;
	});

	m.get(o).prop = "newValue";
	expect(count).toBe(2);
	expect(o.prop).toBe("newValue");
});

test("map keys returns observable objects", () => {
	const target = {};
	let ran = false;
	const m = map();
	m.set(target, target);

	Array.from(m.keys()).forEach(t => {
		ran = true;
		expect(isObservable(t)).toBe(true);
	});

	expect(ran).toBe(true);
});

test("map values returns observable objects", () => {
	const target = {};
	let ran = false;
	const m = map();
	m.set(target, target);

	Array.from(m.values()).forEach(t => {
		ran = true;
		expect(isObservable(t)).toBe(true);
	});

	expect(ran).toBe(true);
});

test("map forEach returns observable key and value", () => {
	const target = {};
	const m = map();
	m.set(target, target);
	expect(
		m.forEach((v, k) => {
			expect(isObservable(k)).toBe(true);
			expect(isObservable(v)).toBe(true);
		})
	);
});

test("set entries returns observable objects", () => {
	const target = {};
	let ran = false;
	const m = map();
	m.set(target, target);

	Array.from(m.entries()).forEach(([k, v]) => {
		ran = true;
		expect(isObservable(k)).toBe(true);
		expect(isObservable(v)).toBe(true);
	});

	expect(ran).toBe(true);
});

test("map equality for observed and target objects", () => {
	let target = {};
	let m = map();
	m.set(target, target);
	let o = observable(target);
	expect(m.has(o)).toBe(true);

	m = map();
	target = {};
	o = observable(target);
	m.set(o, target);
	expect(m.has(target)).toBe(true);
	m.set(target, target);
	expect(m.size).toBe(1);

	m.delete(target);
	expect(m.size).toBe(0);
});

test("instanceof Map", () => {
	const m = map();
	expect(m instanceof Map).toBe(true);
});

test("WeakMap is reactive", () => {
	const m = weakMap();

	const target = {};
	let count = 0;

	autorun(() => {
		count++;
		m.has(target);
	});

	m.set(target, 1);
	expect(count).toBe(2);
	expect(m.get(target)).toBe(1);
});

test("instanceof WeakMap", () => {
	const m = weakMap();
	expect(m instanceof WeakMap).toBe(true);
});

test("WeakMap does not report to have Map methods", () => {
	const m = weakMap();
	expect("size" in m).toBe(false);
	expect((m as any).size).toBe(undefined);
	expect("forEach" in m).toBe(false);
	expect((m as any).forEach).toBe(undefined);
});

test("[mobx-test] map crud", function() {
	const events = [];
	const m = map(new Map(Object.entries({ "1": "a" }))) as Map<any, any>;
	trace(m, function(changes) {
		events.push(changes);
	});

	expect(m.has("1")).toBe(true);
	expect(m.has(1)).toBe(false);
	expect(m.get("1")).toBe("a");
	expect(m.get("b")).toBe(undefined);
	expect(m.size).toBe(1);

	m.set("1", "aa");
	m.set(1, "b");
	expect(m.has("1")).toBe(true);
	expect(m.get("1")).toBe("aa");
	expect(m.get(1)).toBe("b");

	const k = ["arr"];
	m.set(k, "arrVal");
	expect(m.has(k)).toBe(true);
	expect(m.get(k)).toBe("arrVal");

	const s = Symbol("test");
	expect(m.has(s)).toBe(false);
	expect(m.get(s)).toBe(undefined);
	m.set(s, "symbol-value");
	expect(m.get(s)).toBe("symbol-value");
	expect(m.get(s.toString())).toBe(undefined);

	expect(keys(m)).toEqual(["1", 1, k, s]);
	expect(values(m)).toEqual(["aa", "b", "arrVal", "symbol-value"]);
	expect(Array.from(m)).toEqual([
		["1", "aa"],
		[1, "b"],
		[k, "arrVal"],
		[s, "symbol-value"]
	]);

	expect(m.size).toBe(4);

	m.clear();
	expect(keys(m)).toEqual([]);
	expect(values(m)).toEqual([]);
	expect(m.size).toBe(0);

	expect(m.has("a")).toBe(false);
	expect(m.has("b")).toBe(false);
	expect(m.get("a")).toBe(undefined);
	expect(m.get("b")).toBe(undefined);

	expect(events).toEqual([
		{ object: m, name: "1", newValue: "aa", oldValue: "a", type: "update" },
		{ object: m, name: 1, newValue: "b", type: "add" },
		{ object: m, name: ["arr"], newValue: "arrVal", type: "add" },
		{ object: m, name: s, newValue: "symbol-value", type: "add" },
		{ object: m, name: "1", oldValue: "aa", type: "delete" },
		{ object: m, name: 1, oldValue: "b", type: "delete" },
		{ object: m, name: ["arr"], oldValue: "arrVal", type: "delete" },
		{ object: m, name: s, oldValue: "symbol-value", type: "delete" }
	]);
});

test("[mobx-test] observe value", function() {
	const a = map();
	let hasX = false;
	let valueX = undefined;
	let valueY = undefined;

	autorun(function() {
		hasX = a.has("x");
	});

	autorun(function() {
		valueX = a.get("x");
	});

	autorun(function() {
		valueY = a.get("y");
	});

	expect(hasX).toBe(false);
	expect(valueX).toBe(undefined);

	a.set("x", 3);
	expect(hasX).toBe(true);
	expect(valueX).toBe(3);

	a.set("x", 4);
	expect(hasX).toBe(true);
	expect(valueX).toBe(4);

	a.delete("x");
	expect(hasX).toBe(false);
	expect(valueX).toBe(undefined);

	a.set("x", 5);
	expect(hasX).toBe(true);
	expect(valueX).toBe(5);

	expect(valueY).toBe(undefined);
});

test("[mobx-test] initialize with entries", function() {
	const thing = [{ x: 3 }];
	const a = map(
		new Map([
			["a", 1],
			[thing, 2]
		] as any)
	);
	expect(Array.from(a)).toEqual([
		["a", 1],
		[thing, 2]
	]);
});

test("[mobx-test] observe collections", function() {
	const x = map();
	let ks, vs, entries;

	autorun(function() {
		ks = keys(x);
	});
	autorun(function() {
		vs = iteratorToArray(x.values());
	});
	autorun(function() {
		entries = iteratorToArray(x.entries());
	});

	x.set("a", 1);
	expect(ks).toEqual(["a"]);
	expect(vs).toEqual([1]);
	expect(entries).toEqual([["a", 1]]);

	// should not retrigger:
	ks = null;
	vs = null;
	entries = null;
	x.set("a", 1);
	expect(ks).toEqual(null);
	expect(vs).toEqual(null);
	expect(entries).toEqual(null);

	x.set("a", 2);
	expect(vs).toEqual([2]);
	expect(entries).toEqual([["a", 2]]);

	x.set("b", 3);
	expect(ks).toEqual(["a", "b"]);
	expect(vs).toEqual([2, 3]);
	expect(entries).toEqual([
		["a", 2],
		["b", 3]
	]);

	x.has("c");
	expect(ks).toEqual(["a", "b"]);
	expect(vs).toEqual([2, 3]);
	expect(entries).toEqual([
		["a", 2],
		["b", 3]
	]);

	x.delete("a");
	expect(ks).toEqual(["b"]);
	expect(vs).toEqual([3]);
	expect(entries).toEqual([["b", 3]]);
});

test("[mobx-test] cleanup", function() {
	const x = map(new Map(Object.entries({ a: 1 })));

	let aValue;
	const disposer = autorun(function() {
		aValue = x.get("a");
	});

	const adm = getAdministration(x);

	let observable = adm.data.atomMap.get("a");

	expect(aValue).toBe(1);
	expect(observable.observers.size).toBe(1);
	expect(adm.hasMap.get("a").observers.size).toBe(1);

	expect(x.delete("a")).toBe(true);
	expect(x.delete("not-existing")).toBe(false);

	expect(aValue).toBe(undefined);
	expect(observable.observers.size).toBe(0);
	expect(adm.hasMap.get("a").observers.size).toBe(1);

	x.set("a", 2);
	observable = adm.data.atomMap.get("a");

	expect(aValue).toBe(2);
	expect(observable.observers.size).toBe(1);
	expect(adm.hasMap.get("a").observers.size).toBe(1);

	disposer();
	expect(aValue).toBe(2);
	expect(observable.observers.size).toBe(0);
	expect((adm.hasMap as any).map.has("a")).toBe(false);
});

test("[mobx-test] unobserve before delete", function() {
	const propValues = [];
	const myObservable = observable({
		myMap: map()
	}) as any;
	myObservable.myMap.set("myId", {
		myProp: "myPropValue",
		get myCalculatedProp() {
			if (myObservable.myMap.has("myId"))
				return myObservable.myMap.get("myId").myProp + " calculated";
			return undefined;
		}
	});
	// the error only happens if the value is observed
	autorun(function() {
		values(myObservable.myMap).forEach(function(value) {
			propValues.push(value.myCalculatedProp);
		});
	});
	myObservable.myMap.delete("myId");

	expect(propValues).toEqual(["myPropValue calculated"]);
});

test("[mobx-test] has should not throw on invalid keys", function() {
	const x = map();
	expect(x.has(undefined)).toBe(false);
	expect(x.has({})).toBe(false);
	expect(x.get({})).toBe(undefined);
	expect(x.get(undefined)).toBe(undefined);
});

test("[mobx-test] map.clear should not be tracked", () => {
	const x = map(new Map(Object.entries({ a: 3 })));
	let c = 0;
	const d = autorun(() => {
		c++;
		x.clear();
	});

	expect(c).toBe(1);
	x.set("b", 3);
	expect(c).toBe(1);

	d();
});

test("[mobx-test] map keys should be coerced to strings correctly", () => {
	const m = map();
	m.set(1, true);
	m.delete(1);
	expect(keys(m)).toEqual([]);

	m.set(1, true);
	m.set("1", false);
	m.set(0, true);
	m.set(-0, false);
	expect(Array.from(keys(m))).toEqual([1, "1", 0]);
	expect(m.get(-0)).toBe(false);
	expect(m.get(1)).toBe(true);

	m.delete("1");
	expect(Array.from(keys(m))).toEqual([1, 0]);

	m.delete(1);
	expect(keys(m)).toEqual([0]);

	m.set(true, true);
	expect(m.get("true")).toBe(undefined);
	expect(m.get(true)).toBe(true);
	m.delete(true);
	expect(keys(m)).toEqual([0]);
});

test("[mobx-test] support for ES6 Map", () => {
	const x = new Map();
	x.set("x", 3);
	x.set("y", 2);

	const m = map(x);
	expect(isObservable(m)).toBe(true);
	expect(Array.from(m)).toEqual([
		["x", 3],
		["y", 2]
	]);
});

test("[mobx-test] work with 'toString' key", () => {
	const m = map();
	expect(m.get("toString")).toBe(undefined);
	m.set("toString", "test");
	expect(m.get("toString")).toBe("test");
});

test("[mobx-test] can iterate maps", () => {
	const x = map();
	const y = [];
	const d = reaction(
		() => Array.from(x),
		items => y.push(items)
	);

	y.push(Array.from(x));
	x.set("a", "A");
	x.set("b", "B");
	expect(y).toEqual([
		[],
		[["a", "A"]],
		[
			["a", "A"],
			["b", "B"]
		]
	]);
	d();
});

function iteratorToArray(it) {
	const res = [];
	while (true) {
		const r = it.next();
		if (!r.done) {
			res.push(r.value);
		} else {
			break;
		}
	}
	return res;
}

test("[mobx-test] can iterate map - entries", () => {
	const x = map();
	const y = [];
	const d = reaction(
		() => iteratorToArray(x.entries()),
		items => y.push(items)
	);

	y.push(iteratorToArray(x.entries()));
	x.set("a", "A");
	x.set("b", "B");
	expect(y).toEqual([
		[],
		[["a", "A"]],
		[
			["a", "A"],
			["b", "B"]
		]
	]);
	d();
});

test("[mobx-test] can iterate map - keys", () => {
	const x = map();
	const y = [];
	const d = reaction(
		() => iteratorToArray(x.keys()),
		items => y.push(items)
	);

	y.push(iteratorToArray(x.keys()));
	x.set("a", "A");
	x.set("b", "B");
	expect(y).toEqual([[], ["a"], ["a", "b"]]);
	d();
});

test("[mobx-test] can iterate map - values", () => {
	const x = map();
	const y = [];
	const d = reaction(
		() => iteratorToArray(x.values()),
		items => y.push(items)
	);

	y.push(iteratorToArray(x.values()));
	x.set("a", "A");
	x.set("b", "B");
	expect(y).toEqual([[], ["A"], ["A", "B"]]);
	d();
});

test("[mobx-test] NaN as map key", function() {
	const a = map(new Map([[NaN, 0]]));
	expect(a.has(NaN)).toBe(true);
	expect(a.get(NaN)).toBe(0);
	a.set(NaN, 1);
	a.set(NaN, 2);
	expect(a.get(NaN)).toBe(2);
	expect(a.size).toBe(1);
});

test("[mobx-test] maps.values, keys and maps.entries are iterables", () => {
	const x = map(new Map(Object.entries({ x: 1, y: 2 })));
	expect(Array.from(x.entries())).toEqual([
		["x", 1],
		["y", 2]
	]);
	expect(Array.from(x.values())).toEqual([1, 2]);
	expect(Array.from(x.keys())).toEqual(["x", "y"]);
});

test("[mobx-test] toStringTag", () => {
	const x = map(new Map(Object.entries({ x: 1, y: 2 })));
	expect(x[Symbol.toStringTag]).toBe("Map");
	expect(Object.prototype.toString.call(x)).toBe("[object Map]");
});

test("[mobx-test] map.size is reactive", () => {
	const m = map();
	const sizes = [];

	const d = autorun(() => {
		sizes.push(m.size);
	});

	m.set(1, 1);
	m.set(2, 2);
	d();
	m.set(3, 3);
	expect(sizes).toEqual([0, 1, 2]);
});

test("[mobx-test] .forEach() subscribes for key changes", () => {
	const m = map();
	let autorunInvocationCount = 0;

	autorun(() => {
		autorunInvocationCount++;
		m.forEach(_ => {});
	});

	m.set(1, 1);
	m.set(2, 2);
	m.delete(1);

	expect(autorunInvocationCount).toBe(4);
});

test("[mobx-test] .keys() subscribes for key changes", () => {
	const m = map();
	let autorunInvocationCount = 0;

	autorun(() => {
		autorunInvocationCount++;
		for (const _ of m.keys()) {
		}
	});

	m.set(1, 1);
	m.set(2, 2);
	m.delete(1);

	expect(autorunInvocationCount).toBe(4);
});

test("[mobx-test] .values() subscribes for key changes", () => {
	const m = map();
	let autorunInvocationCount = 0;

	autorun(() => {
		autorunInvocationCount++;
		for (const _ of m.values()) {
		}
	});

	m.set(1, 1);
	m.set(2, 2);
	m.delete(1);

	expect(autorunInvocationCount).toBe(4);
});

test("[mobx-test] .entries() subscribes for key changes", () => {
	const m = map();
	let autorunInvocationCount = 0;

	autorun(() => {
		autorunInvocationCount++;
		for (const _ of m.entries()) {
		}
	});

	m.set(1, 1);
	m.set(2, 2);
	m.delete(1);

	expect(autorunInvocationCount).toBe(4);
});

test("[mobx-test] .entries() subscribes for value changes", () => {
	const m = map(
		new Map([
			[1, 1],
			[2, 2],
			[3, 3]
		])
	);
	let autorunInvocationCount = 0;

	autorun(() => {
		autorunInvocationCount++;
		for (const _ of m.entries()) {
		}
	});

	m.set(1, 11);
	m.set(2, 22);
	m.set(3, 33);

	expect(autorunInvocationCount).toBe(4);
});

test("[mobx-test] .values() subscribes for value changes", () => {
	const m = map(
		new Map([
			[1, 1],
			[2, 2],
			[3, 3]
		])
	);
	let autorunInvocationCount = 0;

	autorun(() => {
		autorunInvocationCount++;
		for (const _ of m.values()) {
		}
	});

	m.set(1, 11);
	m.set(2, 22);
	m.set(3, 33);

	expect(autorunInvocationCount).toBe(4);
});

test("[mobx-test] .forEach() subscribes for value changes", () => {
	const m = map(
		new Map([
			[1, 1],
			[2, 2],
			[3, 3]
		])
	);
	let autorunInvocationCount = 0;

	autorun(() => {
		autorunInvocationCount++;
		m.forEach(_ => {});
	});

	m.set(1, 11);
	m.set(2, 22);
	m.set(3, 33);

	expect(autorunInvocationCount).toBe(4);
});

test("[mobx-test] .keys() does NOT subscribe for value changes", () => {
	const m = map(
		new Map([
			[1, 1],
			[2, 2],
			[3, 3]
		])
	);
	let autorunInvocationCount = 0;

	autorun(() => {
		autorunInvocationCount++;
		for (const _ of m.keys()) {
		}
	});

	m.set(1, 11);
	m.set(2, 22);
	m.set(3, 33);

	expect(autorunInvocationCount).toBe(1);
});

test("[mobx-test] noop mutations do NOT reportChanges", () => {
	const m = map(
		new Map([
			[1, 1],
			[2, 2],
			[3, 3]
		])
	);
	let autorunInvocationCount = 0;

	autorun(() => {
		autorunInvocationCount++;
		m.forEach(_ => {});
	});

	m.set(1, 1);
	m.set(2, 2);
	m.set(3, 3);
	m.delete("NOT IN MAP" as any);

	expect(autorunInvocationCount).toBe(1);
});

test("[mobx-test] iterators should be resilient to concurrent delete operation", () => {
	function testIterator(method) {
		const m = map(
			new Map([
				[1, 1],
				[2, 2],
				[3, 3]
			])
		);
		const expectedMap = map(
			new Map([
				[1, 1],
				[2, 2],
				[3, 3]
			])
		);
		for (const entry of m[method]()) {
			const key = Array.isArray(entry) ? entry[0] : entry;
			const deleted1 = m.delete(key);
			const deleted2 = expectedMap.delete(key);
			expect(deleted1).toBe(true);
			expect(deleted2).toBe(true);
			expect(m.size).toBe(expectedMap.size);
			expect(Array.from(m)).toEqual(Array.from(expectedMap));
		}
	}

	testIterator("keys");
	testIterator("values");
	testIterator("entries");
});
