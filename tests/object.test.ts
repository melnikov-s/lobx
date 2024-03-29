import {
	autorun,
	reaction,
	observable,
	runInAction,
	computed,
	action,
	observe,
	enforceActions,
	isObservable,
	getObservableSource,
	decorate,
	isInAction,
} from "../src/index";

function object<T extends object>(obj: T = {} as T): Record<string, any> {
	return observable(obj);
}

test("observable values do not get stored on the original target", () => {
	const target = { prop: undefined };
	const o = object(target);
	const oTarget = { prop: "value" };
	const c = observable(oTarget);

	o.prop = c;
	expect(o.prop).toBe(c);
	expect(target.prop).not.toBe(c);
	expect(target.prop).toEqual(o.prop);
	expect(target.prop).toBe(oTarget);
});

test("observable values do not get stored on the original target (Object.assign)", () => {
	const target = { prop: undefined };
	const o = object(target);
	const oTarget = { prop: "value" };
	const c = observable(oTarget);

	Object.assign(o, { prop: c });
	expect(o.prop).toBe(c);
	expect(target.prop).not.toBe(c);
	expect(target.prop).toEqual(o.prop);
	expect(target.prop).toBe(oTarget);
});

test("getters on the object become computed", () => {
	let count = 0;
	const o = observable({
		prop: 1,
		get comp() {
			count++;
			return this.prop * 2;
		},
	});

	autorun(() => o.comp);
	expect(o.comp).toBe(2);
	expect(count).toBe(1);
	o.prop++;
	expect(o.comp).toBe(4);
	o.comp;
	expect(count).toBe(2);
});

test("observable objects can be configured", () => {
	enforceActions(true);
	try {
		const o = observable.configure(
			{
				observableValue: observable,
				comp: computed,
				inc: action,
			},
			{
				count: 0,
				observableValue: 0,
				nonObservableValue: 0,
				get comp() {
					this.count++;
					return this.observableValue * 2;
				},
				inc() {
					this.observableValue++;
					this.observableValue++;
				},
			}
		);

		let count = 0;

		autorun(() => {
			o.comp;
			count++;
		});

		o.inc();
		expect(count).toBe(2);
		expect(o.comp).toBe(4);
		expect(o.count).toBe(2);
		o.nonObservableValue++;
		expect(count).toBe(2);
	} finally {
		enforceActions(false);
	}
});

test("observable objects can be configured with function", () => {
	enforceActions(true);
	try {
		const o = observable.configure(
			(name, object) => {
				expect(object).toBe(o);
				switch (name) {
					case "observableValue":
						return observable;
					case "comp":
						return computed;
					case "inc":
						return action;
				}
			},
			{
				count: 0,
				observableValue: 0,
				nonObservableValue: 0,
				get comp() {
					this.count++;
					return this.observableValue * 2;
				},
				inc() {
					this.observableValue++;
					this.observableValue++;
				},
			}
		);

		let count = 0;

		autorun(() => {
			o.comp;
			o.nonObservableValue;
			count++;
		});

		o.inc();
		expect(count).toBe(2);
		expect(o.comp).toBe(4);
		expect(o.count).toBe(2);
		o.nonObservableValue++;
		expect(count).toBe(2);
	} finally {
		enforceActions(false);
	}
});

test("observable objects can be configured with config overwriting defaults", () => {
	enforceActions(true);
	try {
		const o = observable.configure(
			{
				observableValue: observable,
				inc: action,
				comp: computed,
				nonObservableValue: undefined,
			},
			{
				count: 0,
				nonObservableValue: 0,
				observableValue: 0,
				nonConfiguredValue: 0,
				nonConfiguredAction() {
					this.nonConfiguredValue++;
				},
				get comp() {
					this.count++;
					return this.observableValue * 2;
				},
				inc() {
					this.observableValue++;
					this.observableValue++;
				},
			},
			{ withDefaults: true }
		);

		let count = 0;

		autorun(() => {
			o.comp;
			o.nonConfiguredValue;
			o.nonObservableValue;
			count++;
		});

		o.inc();
		expect(count).toBe(2);
		expect(o.comp).toBe(4);
		expect(o.count).toBe(2);
		o.nonConfiguredAction();
		expect(count).toBe(3);
		o.nonObservableValue++;
		expect(count).toBe(3);
	} finally {
		enforceActions(false);
	}
});

test("observable objects can be configured with function overwriting defaults", () => {
	enforceActions(true);
	try {
		const o = observable.configure(
			(name, object) => {
				expect(object).toBe(o);
				switch (name) {
					case "observableValue":
						return observable;
					case "comp":
						return computed;
					case "inc":
						return action;
				}
			},
			{
				count: 0,
				observableValue: 0,
				nonConfiguredValue: 0,
				nonConfiguredAction() {
					this.nonConfiguredValue++;
				},
				get comp() {
					this.count++;
					return this.observableValue * 2;
				},
				inc() {
					this.observableValue++;
					this.observableValue++;
				},
			},
			{ withDefaults: true }
		);

		let count = 0;

		autorun(() => {
			o.comp;
			o.nonConfiguredValue;
			count++;
		});

		o.inc();
		expect(count).toBe(2);
		expect(o.comp).toBe(4);
		expect(o.count).toBe(2);
		o.nonConfiguredAction();
		expect(count).toBe(3);
	} finally {
		enforceActions(false);
	}
});

test("observable object methods can be bound", () => {
	enforceActions(true);
	try {
		const o = observable.configure(
			{
				val: observable,
				inc: action.opts({ bound: true }),
			},
			{
				count: 0,
				val: 0,
				inc() {
					expect(isInAction()).toBe(true);
					this.val++;
					this.val++;
				},
			}
		);

		let count = 0;

		autorun(() => {
			o.val;
			count++;
		});

		const inc = o.inc;
		inc();
		expect(count).toBe(2);
		expect(o.val).toBe(2);
	} finally {
		enforceActions(false);
	}
});

test("can retrieve Object.prototype properties from observable objects", () => {
	const properties = Object.getOwnPropertyNames(Object.prototype);
	const o = observable.configure({}, {});
	expect(() => properties.forEach((n) => o[n])).not.toThrow();
});

test("can only have one observable proxy per object", () => {
	const target = {};

	expect(object(target)).toBe(object(target));
});

test("target is updated when observable value updates", () => {
	const target = {} as any;
	const o = object(target);
	o.prop = "value";
	expect(target.prop).toBe("value");
});

test("observable value is updated when target is updated", () => {
	let count = 0;
	const target = {} as any;
	const o = object(target);

	reaction(
		() => "prop" in o,
		() => count++
	);

	target.prop = "value"; // not observed
	expect(count).toBe(0);
	expect(o.prop).toBe("value");
	o.prop = "value2"; // too late, value already exists
	expect(count).toBe(0);
	delete o.prop; // not seen as a change
	expect(count).toBe(0);
	o.prop = "value"; // recovered
	expect(count).toBe(1);
	delete target.prop;
	expect("prop" in o).toBe(false);
	expect(count).toBe(1);
});

test("observable objects are deeply observed", () => {
	const o = object({
		obj: { prop: "value ", obj: { prop: "value " } },
		arr: [1, 2, 3],
	});

	let count = 0;

	autorun(() => {
		o.obj.prop;
		o.arr.length;
		"objB" in o && "obj" in o.objB && o.objB.obj.prop;
		count++;
	});

	o.obj.prop = "newValue";
	expect(count).toBe(2);
	o.arr.push(4);
	expect(count).toBe(3);
	o.objB = {};
	expect(count).toBe(4);
	o.objB.obj = {};
	expect(count).toBe(5);
	o.objB.obj.prop = "value";
	expect(count).toBe(6);
});

test("does not respond to no-op", () => {
	let count = 0;
	const x = object({});

	autorun(() => {
		count++;
		return x.x;
	});

	x.x = 1;
	expect(count).toBe(2);
	x.x = 2;
	expect(count).toBe(3);
	x.x = 2;
	expect(count).toBe(3);
});

test("observes decorated non plain objects directly", () => {
	let count = 0;
	let countComp = 0;
	class C {
		prop = 0;
		get comp() {
			countComp++;
			return this.prop * 2;
		}
	}
	decorate({ prop: observable, comp: computed }, C);
	const o = observable(new C());
	autorun(() => {
		count++;
		o.comp;
	});
	expect(count).toBe(1);
	expect(o.comp).toBe(0);
	expect(countComp).toBe(1);
	o.prop++;
	expect(count).toBe(2);
	expect(o.comp).toBe(2);
	expect(countComp).toBe(2);
});

test("does not deeply observe non configured non plain objects", () => {
	const C = class {};
	const o = object({ v: new C() });
	expect(o.v).toBeInstanceOf(C);
	expect(isObservable(o.v)).toBe(false);
});

test("does not observe constructors indirectly", () => {
	const C = class {};
	const o = object({ v: C });
	expect(isObservable(new o.v())).toBe(false);
});

test("observes decorated non plain objects", () => {
	const C = class {};
	decorate({}, C);
	const o = object({ v: new C() });
	expect(o.v).toBeInstanceOf(C);
	expect(isObservable(o.v)).toBe(true);
});

test("frozen objects are not observed", () => {
	const o = object({ toBeFrozen: {} });
	Object.freeze(getObservableSource(o).toBeFrozen);
	expect(isObservable(o.toBeFrozen)).toBe(false);
});

test("observe occurs before reaction", () => {
	const o = object({ a: 1 });
	const buf = [];

	observe(o, function () {
		buf.push("trace1");
	});

	reaction(
		() => o.a,
		() => buf.push("reaction")
	);

	observe(o, function () {
		buf.push("trace2");
	});

	o.a = 2; // update
	delete o.a; // delete
	o.a = 3; // add

	expect(buf).toEqual([
		"trace1",
		"trace2",
		"reaction",
		"trace1",
		"trace2",
		"reaction",
		"trace1",
		"trace2",
		"reaction",
	]);
});

test("[mobx-test] object crud", function () {
	const events = [];
	const o = object({ "1": "a" });
	observe(o, function (changes) {
		events.push(changes);
	});

	expect("1" in o).toBe(true);
	expect(1 in o).toBe(true);
	expect(o["1"]).toBe("a");
	expect(o["b"]).toBe(undefined);
	expect(Object.keys(o).length).toBe(1);

	o["1"] = "aa";
	o[1] = "b";
	expect("1" in o).toBe(true);
	expect(o["1"]).toBe("b");
	expect(o[1]).toBe("b");

	expect(Object.keys(o)).toEqual(["1"]);
	expect(Object.values(o)).toEqual(["b"]);
	expect(Array.from(Object.entries(o))).toEqual([["1", "b"]]);

	expect(Object.keys(o).length).toBe(1);

	Object.keys(o).forEach((k) => delete o[k]);
	expect(Object.keys(o)).toEqual([]);
	expect(Object.values(o)).toEqual([]);
	expect(Object.keys(o).length).toBe(0);

	expect("a" in o).toBe(false);
	expect("b" in o).toBe(false);
	expect(o["a"]).toBe(undefined);
	expect(o["b"]).toBe(undefined);

	o["2"] = "a";

	expect(events).toEqual([
		{ object: o, name: "1", newValue: "aa", oldValue: "a", type: "update" },
		{ object: o, name: "1", newValue: "b", oldValue: "aa", type: "update" },
		{ object: o, name: "1", oldValue: "b", type: "delete" },
		{ object: o, name: "2", newValue: "a", type: "add" },
	]);
});

test("[mobx-test] keys should be observable when extending", () => {
	const todos = object({});

	const todoTitles = [];
	reaction(
		() => Object.keys(todos).map((key) => `${key}: ${todos[key]}`),
		(titles) => todoTitles.push(titles.join(","))
	);

	runInAction(() => {
		Object.assign(todos, {
			lewis: "Read Lewis",
			chesterton: "Be mind blown by Chesterton",
		});
	});
	expect(todoTitles).toEqual([
		"lewis: Read Lewis,chesterton: Be mind blown by Chesterton",
	]);

	Object.assign(todos, { lewis: "Read Lewis twice" });
	Object.assign(todos, { coffee: "Grab coffee" });
	expect(todoTitles).toEqual([
		"lewis: Read Lewis,chesterton: Be mind blown by Chesterton",
		"lewis: Read Lewis twice,chesterton: Be mind blown by Chesterton",
		"lewis: Read Lewis twice,chesterton: Be mind blown by Chesterton,coffee: Grab coffee",
	]);
});

test("[mobx-test] object - set, remove, values are reactive", () => {
	const todos = object({});
	const snapshots = [];

	reaction(
		() => Object.values(todos),
		(values) => snapshots.push(values)
	);

	expect("x" in todos).toBe(false);
	expect(todos.x).toBe(undefined);
	todos.x = 3;
	expect("x" in todos).toBe(true);
	expect(todos.x).toBe(3);
	delete todos.y;
	todos.z = 4;
	todos.x = 5;
	delete todos.z;

	expect(snapshots).toEqual([[3], [3, 4], [5, 4], [5]]);
});

test("[mobx-test] object - set, remove, entries are reactive", () => {
	const todos = object({});
	const snapshots = [];

	reaction(
		() => Object.entries(todos),
		(entries) => snapshots.push(entries)
	);

	expect("x" in todos).toBe(false);
	expect(todos.x).toBe(undefined);
	todos.x = 3;
	expect("x" in todos).toBe(true);
	expect(todos.x).toBe(3);
	delete todos.y;
	todos.z = 4;
	todos.x = 5;
	delete todos.z;

	expect(snapshots).toEqual([
		[["x", 3]],
		[
			["x", 3],
			["z", 4],
		],
		[
			["x", 5],
			["z", 4],
		],
		[["x", 5]],
	]);
});

test("[mobx-test] object - set, remove, keys are reactive", () => {
	const todos = object({ a: 3 });
	const snapshots = [];

	reaction(
		() => Object.keys(todos),
		(keys) => snapshots.push(keys)
	);

	todos.x = 3;
	delete todos.y;
	todos.z = 4;
	todos.x = 5;
	delete todos.z;
	delete todos.a;

	expect(snapshots).toEqual([["a", "x"], ["a", "x", "z"], ["a", "x"], ["x"]]);
});

test("[mobx-test] has and get are reactive", async () => {
	const todos = object({});
	let count = 0;

	reaction(
		() => {
			return "x" in todos;
		},
		(b) => b && count++
	);

	reaction(
		() => {
			return todos.y === 3;
		},
		(b) => b && count++
	);

	expect(count).toBe(0);

	Object.assign(todos, { x: false, y: 3 });

	expect(count).toBe(2);
});

test("[mobx-test] getter props are considered part of collections", () => {
	const x = object({
		get y() {
			return 3;
		},
	});
	expect(x.y).toBe(3);
	expect("y" in x).toBe(true); // `in` also checks proto type, so should return true!
	expect(Object.keys(x)).toEqual(["y"]);
	expect(Object.values(x)).toEqual([3]);
	expect(Object.entries(x)).toEqual([["y", 3]]);
});

test("[mobx-test] delete and undelete should work", () => {
	const x = object({});

	const events = [];
	autorun(() => {
		events.push("a" in x);
	});

	x.a = 1;
	x.a++;
	delete x.a;
	x.a = 5;
	delete x.a;
	x.a = 5;
	expect(events).toEqual([false, true, false, true, false, true]);
});

test("[mobx-test] should react to key removal (unless reconfiguring to empty) - 1", () => {
	const events = [];
	const x = object({
		y: 1,
		z: 1,
	});

	reaction(
		() => Object.keys(x),
		(keys) => events.push(keys.join(","))
	);

	events.push(Object.keys(x).join(","));
	expect(events).toEqual(["y,z"]);
	delete x.y;
	expect(events).toEqual(["y,z", "z"]);
	// should not trigger another time..
	delete x.y;
	expect(events).toEqual(["y,z", "z"]);
});

test("[mobx-test] should react to key removal (unless reconfiguring to empty) - 2", () => {
	const events = [];
	const x = object({
		y: 1,
		z: 1,
	});

	reaction(
		() => x.z,
		(v) => events.push(v)
	);

	delete x.z;
	expect(events).toEqual([undefined]);
});

test("[mobx-test] should react to key removal (unless reconfiguring to empty) - 2", () => {
	const events = [];
	const x = object({
		y: 1,
		z: undefined,
	});

	reaction(
		() => x.z,
		(v) => events.push(v)
	);

	delete x.z;
	expect(events).toEqual([]);
});

test("[mobx-test] should react to future key additions - 1", () => {
	const events = [];
	const x = object({});

	reaction(
		() => Object.keys(x),
		(keys) => events.push(keys.join(","))
	);

	x.y = undefined;
	expect(events).toEqual(["y"]);
});

test("[mobx-test] should react to future key additions - 2", () => {
	const events = [];
	const x = object({});

	reaction(
		() => {
			return x.z;
		},
		(v) => {
			events.push(v);
		}
	);

	x.z = undefined;
	expect(Object.keys(x)).toEqual(["z"]);
	x.y = 3;
	expect(events).toEqual([]);
	delete x.y;
	expect(events).toEqual([]);
	x.z = 4;
	expect(events).toEqual([4]);
});

test("[mobx-test] correct keys are reported", () => {
	const x = object({
		x: 1,
		get y() {
			return 2;
		},
		a: 4,
		get b() {
			return 5;
		},
	});
	x.z = 3;
	x.y;
	x.b; // make sure it is read

	expect(Object.keys(x)).toEqual(["x", "y", "a", "b", "z"]);
	expect(Object.values(x)).toEqual([1, 2, 4, 5, 3]);
	expect(Object.entries(x)).toEqual([
		["x", 1],
		["y", 2],
		["a", 4],
		["b", 5],
		["z", 3],
	]);

	expect(Object.getOwnPropertyNames(x)).toEqual(["x", "y", "a", "b", "z"]);
	expect(Object.keys(x)).toEqual(["x", "y", "a", "b", "z"]);

	delete x.x;
	expect(Object.keys(x)).toEqual(["y", "a", "b", "z"]);
	expect(Object.getOwnPropertyNames(x)).toEqual(["y", "a", "b", "z"]);
	expect(Object.keys(x)).toEqual(["y", "a", "b", "z"]);
});

test("[mobx-test] in operator", () => {
	const x = object({
		x: 1,
		get y() {
			return 2;
		},
		a: 4,
		get b() {
			return 5;
		},
	});
	x.z = 3;
	expect("x" in x).toBeTruthy();
	expect("y" in x).toBeTruthy();
	expect("a" in x).toBeTruthy();
	expect("b" in x).toBeTruthy();
	expect("z" in x).toBeTruthy();
	expect("c" in x).toBeFalsy();
	expect("c" in x).toBeFalsy(); // not accidentally create
	delete x.x;
	expect("x" in x).toBeFalsy();
});

test("[mobx-test] for-in operator", () => {
	const x = object({
		x: 1,
		get y() {
			return 2;
		},
		a: 4,
		get b() {
			return 5;
		},
	});
	x.z = 3;

	function computeKeys() {
		const res = [];
		for (const key in x) res.push(key);
		return res;
	}

	expect(computeKeys()).toEqual(["x", "y", "a", "b", "z"]);
	delete x.x;
	expect(computeKeys()).toEqual(["y", "a", "b", "z"]);
});

test("[mobx-test] type coercion doesn't break", () => {
	const x = object({});
	expect("" + x).toBe("[object Object]");
	expect(42 * (x as any)).toBeNaN();
});

test("[mobx-test] adding a different key doesn't trigger a pending key", () => {
	const x = object({});
	let counter = 0;

	const d = autorun(() => {
		x.x;
		counter++;
	});
	expect(counter).toBe(1);

	x.y = 3;
	expect(counter).toBe(1);

	x.x = 3;
	expect(counter).toBe(2);

	d();
});

test("[mobx-test] ownKeys invariant not broken - 1", () => {
	const a = object({
		x: 3,
		get y() {
			return 1;
		},
	});
	expect(() => {
		Object.freeze(a);
	}).toThrow("cannot be frozen");
});

test("[mobx-test] deleting / recreate prop", () => {
	const value = object({
		foo: undefined, // if foo is something like 'abc', it works.
	});

	const events = [];

	autorun(() => {
		events.push(value.foo);
	});
	delete value.foo;
	value.foo = "def";
	expect(events).toEqual([
		undefined,
		undefined, // ideally  not, but ok..
		"def",
	]);
});
