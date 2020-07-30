import {
	autorun,
	observable,
	isObservable,
	trace,
	getObservableSource
} from "../src/index";

const set = <T>(obj: Set<T> = new Set()): Set<T> => {
	return observable(obj);
};

const weakSet = <T extends object>(
	obj: WeakSet<T> = new WeakSet()
): WeakSet<T> => {
	return observable(obj);
};

const keys = <T>(set: Set<T>): T[] => {
	return Array.from(set.keys());
};

test("only reacts to accessed values", () => {
	let count = 0;

	const s = set();
	autorun(() => {
		s.has(1);
		count++;
	});

	s.add(2);
	expect(count).toBe(1);
	s.delete(1);
	expect(count).toBe(1);
	s.add(1);
	expect(count).toBe(2);
	s.delete(2);
	expect(count).toBe(2);
	s.delete(1);
	expect(count).toBe(3);
});

test("set.forEach is reactive", () => {
	let c = 0;
	const s = set();

	autorun(() => {
		s.forEach(() => {});
		c++;
	});

	s.add(1);
	s.add(2);
	expect(c).toBe(3);
});

test("set forEach returns observable objects", () => {
	const target = {};
	let ran = false;
	const s = set();
	s.add(target);

	s.forEach(t => {
		ran = true;
		expect(isObservable(t)).toBe(true);
	});

	expect(ran).toBe(true);
});

test("set keys returns observable objects", () => {
	const target = {};
	let ran = false;
	const s = set();
	s.add(target);

	Array.from(s.keys()).forEach(t => {
		ran = true;
		expect(isObservable(t)).toBe(true);
	});

	expect(ran).toBe(true);
});

test("set values returns observable objects", () => {
	const target = {};
	let ran = false;
	const s = set();
	s.add(target);

	Array.from(s.values()).forEach(t => {
		ran = true;
		expect(isObservable(t)).toBe(true);
	});

	expect(ran).toBe(true);
});

test("set entries returns observable objects", () => {
	const target = {};
	let ran = false;
	const s = set();
	s.add(target);

	Array.from(s.entries()).forEach(([k, v]) => {
		ran = true;
		expect(isObservable(k)).toBe(true);
		expect(isObservable(v)).toBe(true);
	});

	expect(ran).toBe(true);
});

test("set equality for observed and target objects", () => {
	let target = {};
	let s = set();
	s.add(target);
	let o = observable(target);
	expect(s.has(o)).toBe(true);

	s = set();
	target = {};
	o = observable(target);
	s.add(o);
	expect(s.has(target)).toBe(true);
	s.add(target);
	expect(s.size).toBe(1);

	s.delete(target);
	expect(s.size).toBe(0);
});

test("instanceof Set", () => {
	const s = set();
	expect(s instanceof Set).toBe(true);
});

test("set can be initialized with observable values", () => {
	const o1 = observable({});
	const o2 = observable({});
	const o3 = {};

	const s = set(new Set([o1, o2, o3]));
	expect(s.has(getObservableSource(o1))).toBe(true);
	expect(s.has(getObservableSource(o2))).toBe(true);
	s.add(o1);
	expect(s.size).toBe(3);
	s.add(o2);
	expect(s.size).toBe(3);
	expect(s.has(o1)).toBe(true);
	expect(s.has(o2)).toBe(true);
	expect(s.has(o3)).toBe(true);
	expect(s.has(observable(o3))).toBe(true);
	s.add(observable(o3));
	expect(s.size).toBe(3);
	s.delete(observable(o3));
	expect(s.size).toBe(2);
	s.delete(getObservableSource(o1));
	expect(s.size).toBe(2);
	s.delete(o1);
	expect(s.size).toBe(1);
	s.delete(o2);
	expect(s.size).toBe(0);
});

test("does not trigger a change when same observable is set on set initialized with observable values", () => {
	const o1 = observable({ prop: 1 });
	const o2 = observable({ prop: 2 });

	const s = set(new Set([o1, o2]));

	let count = 0;
	autorun(() => {
		s.forEach(() => {});
		count++;
	});
	expect(count).toBe(1);
	s.add(o1);
	expect(s.size).toBe(2);
	expect(count).toBe(1);
	s.add(getObservableSource(o1));
	expect(s.size).toBe(2);
	expect(count).toBe(1);
	s.delete(o2);
	expect(s.size).toBe(1);
	expect(count).toBe(2);
});

test("WeakSet is reactive", () => {
	const s = weakSet();

	const target = {};
	let count = 0;

	autorun(() => {
		count++;
		s.has(target);
	});

	s.add(target);
	expect(count).toBe(2);
	expect(s.has(target)).toBe(true);
});

test("WeakSet does not report to have Set methods", () => {
	const s = weakSet();
	expect("size" in s).toBe(false);
	expect((s as any).size).toBe(undefined);
	expect("forEach" in s).toBe(false);
	expect((s as any).forEach).toBe(undefined);
});

test("instanceof WeakSet", () => {
	const s = weakSet();
	expect(s instanceof WeakSet).toBe(true);
});

test("[mobx-test] set crud", function() {
	const events = [];
	const s = set(new Set([1])) as Set<any>;

	const u = trace(s, changes => {
		events.push(changes);
	});

	expect(s.has(1)).toBe(true);
	expect(s.has("1")).toBe(false);
	expect(s.size).toBe(1);

	s.add("2");

	expect(s.has("2")).toBe(true);
	expect(s.size).toBe(2);
	expect(keys(s)).toEqual([1, "2"]);
	expect(Array.from(s)).toEqual([1, "2"]);
	expect(Array.from(s)).toEqual([1, "2"]);

	s.clear();
	s.add(3);

	expect(keys(s)).toEqual([3]);
	expect(Array.from(s)).toEqual([3]);
	expect(s.size).toBe(1);
	expect(s.has(1)).toBe(false);
	expect(s.has("2")).toBe(false);
	expect(s.has(3)).toBe(true);

	s.clear();
	s.add(4);

	expect(keys(s)).toEqual([4]);
	expect(Array.from(s)).toEqual([4]);
	expect(s.size).toBe(1);
	expect(s.has(1)).toBe(false);
	expect(s.has("2")).toBe(false);
	expect(s.has(3)).toBe(false);
	expect(s.has(4)).toBe(true);

	s.clear();
	expect(keys(s)).toEqual([]);
	expect(Array.from(s)).toEqual([]);
	expect(s.size).toBe(0);
	expect(s.has(1)).toBe(false);
	expect(s.has("2")).toBe(false);
	expect(s.has(3)).toBe(false);
	expect(s.has(4)).toBe(false);

	u();
	expect(events).toEqual([
		{ object: s, newValue: "2", type: "add" },
		{ object: s, oldValue: 1, type: "delete" },
		{ object: s, oldValue: "2", type: "delete" },
		{ object: s, newValue: 3, type: "add" },
		{ object: s, oldValue: 3, type: "delete" },
		{ object: s, newValue: 4, type: "add" },
		{ object: s, oldValue: 4, type: "delete" }
	]);
});

test("[mobx-test] observe value", function() {
	const s = set();
	let hasX = false;
	let hasY = false;

	autorun(function() {
		hasX = s.has("x");
	});
	autorun(function() {
		hasY = s.has("y");
	});

	expect(hasX).toBe(false);

	s.add("x");
	expect(hasX).toBe(true);

	s.delete("x");
	expect(hasX).toBe(false);
	expect(hasY).toBe(false);
});

test("[mobx-test] observe collections", function() {
	const x = set();
	let ks, values, entries;

	autorun(function() {
		ks = keys(x);
	});
	autorun(function() {
		values = Array.from(x.values());
	});
	autorun(function() {
		entries = Array.from(x.entries());
	});

	x.add("a");
	expect(ks).toEqual(["a"]);
	expect(values).toEqual(["a"]);
	expect(entries).toEqual([["a", "a"]]);

	x.forEach(value => {
		expect(x.has(value)).toBe(true);
	});

	// should not retrigger:
	ks = null;
	values = null;
	entries = null;
	x.add("a");
	expect(ks).toEqual(null);
	expect(values).toEqual(null);
	expect(entries).toEqual(null);

	x.add("b");
	expect(ks).toEqual(["a", "b"]);
	expect(values).toEqual(["a", "b"]);
	expect(entries).toEqual([
		["a", "a"],
		["b", "b"]
	]);

	x.delete("a");
	expect(ks).toEqual(["b"]);
	expect(values).toEqual(["b"]);
	expect(entries).toEqual([["b", "b"]]);
});

test("[mobx-test] cleanup", function() {
	const s = set(new Set(["a"]));

	let hasA;

	autorun(function() {
		hasA = s.has("a");
	});

	expect(hasA).toBe(true);
	expect(s.delete("a")).toBe(true);
	expect(s.delete("not-existing")).toBe(false);
	expect(hasA).toBe(false);
});

test("[mobx-test] set should support iterall / iterable ", () => {
	const a = set(new Set([1, 2]));

	function leech(iter) {
		const values = [];
		let v;
		do {
			v = iter.next();
			if (!v.done) values.push(v.value);
		} while (!v.done);
		return values;
	}

	expect(leech(a.entries())).toEqual([
		[1, 1],
		[2, 2]
	]);

	expect(leech(a.keys())).toEqual([1, 2]);
	expect(leech(a.values())).toEqual([1, 2]);
});

test("[mobx-test] set.clear should not be tracked", () => {
	const x = set(new Set([1]));
	let c = 0;
	const d = autorun(() => {
		c++;
		x.clear();
	});

	expect(c).toBe(1);
	x.add(2);
	expect(c).toBe(1);

	d();
});

test("[mobx-test] toStringTag", () => {
	const x = set();
	expect(x[Symbol.toStringTag]).toBe("Set");
	expect(Object.prototype.toString.call(x)).toBe("[object Set]");
});
