import {
	autorun,
	observable,
	isObservable,
	type,
	enforceActions,
	getObservableSource,
	task
} from "../src/index";

test("objects created from class are observable", () => {
	const C = observable(class {});

	const o = new C();
	expect(isObservable(o)).toBe(true);
});

test("objects create from class have observable properties", () => {
	const C = observable(
		class {
			value = "prop";
		}
	);

	const o = new C();
	let count = 0;

	autorun(() => {
		o.value;
		count++;
	});

	o.value = "newProp";
	expect(count).toBe(2);
});

test("object methods return a value", () => {
	const C = observable(
		class {
			value = "prop";

			readValue() {
				return this.value;
			}
		}
	);

	const o = new C();
	expect(o.readValue()).toBe("prop");
});

test("object methods occur in a transaction", () => {
	const C = observable(
		class {
			valueA = 0;
			valueB = 0;

			inc() {
				this.valueA++;
				this.valueB++;
			}
		}
	);

	const o = new C();
	let count = 0;

	autorun(() => {
		o.valueA;
		o.valueB;
		count++;
	});

	o.inc();
	expect(count).toBe(2);
});

test("object methods are observable", () => {
	const C = observable(
		class {
			value = "prop";

			readValue() {
				return this.value;
			}
		}
	);

	const o = new C();
	let count = 0;

	autorun(() => {
		o.readValue();
		count++;
	});

	o.value = "newProp";
	expect(count).toBe(2);
});

test("object setters occur in a transaction", () => {
	const C = observable(
		class {
			valueA = 0;
			valueB = 0;

			set values(v: number) {
				this.valueA = v;
				this.valueB = v;
			}
		}
	);

	const o = new C();
	let count = 0;

	autorun(() => {
		o.valueA;
		o.valueB;
		count++;
	});

	o.values = 1;
	expect(count).toBe(2);
});

test("object getters return a value", () => {
	const C = observable(
		class {
			value = "prop";

			get readValue() {
				return this.value;
			}
		}
	);

	const o = new C();
	expect(o.readValue).toBe("prop");
});

test("object getters are observable", () => {
	const C = observable(
		class {
			value = "prop";

			get readValue() {
				return this.value;
			}
		}
	);

	const o = new C();
	let count = 0;

	autorun(() => {
		o.readValue;
		count++;
	});

	o.value = "newProp";
	expect(count).toBe(2);
});

test("can have properties that are Promise", async () => {
	const C = observable(
		class {
			value = Promise.resolve(42);
		}
	);

	const o = new C();
	const v = await o.value;
	expect(v).toBe(42);
});

test("properties can not be reconfigured", () => {
	const C = class {};

	observable.configure({}, C);
	expect(() => observable.configure({}, C)).toThrowError();
});

test("properties can not be reconfigured on an instance", () => {
	const C = observable.configure({}, class {});
	const c = new C();
	expect(() => observable.configure({}, c)).toThrowError();
});

test("observable returns the configured class", () => {
	const C = class {};
	const OC = observable.configure({}, C);
	expect(observable(C)).toBe(OC);
});

test("observable returns the configured instance with proxied constructor", () => {
	const C = observable.configure({}, class {});
	const c = new C();
	expect(observable(getObservableSource(c))).toBe(c);
});

test("properties can be configured to be observable", () => {
	const C = observable.configure(
		{
			valueA: type.observable
		},
		class {
			valueA = 1;
			valueB = 1;
		}
	);

	let count = 0;
	const o = new C();

	autorun(() => {
		count++;
		o.valueA;
		o.valueB;
	});

	o.valueA++;
	expect(count).toBe(2);
	o.valueB++;
	expect(count).toBe(2);
});

test("unconfigured values are not observed", () => {
	const C = observable.configure(
		{},
		class {
			value = {};
		}
	);

	let count = 0;
	const o = new C();

	expect(isObservable(o.value)).toBe(false);
	autorun(() => {
		count++;
		o.value;
		"value" in o;
	});
	o.value = {};
	expect(count).toBe(1);
	expect(isObservable(o.value)).toBe(false);
});

test("properties can be configured to be observable refs", () => {
	const C = observable.configure(
		{
			value: type.observable({ ref: true })
		},
		class {
			value = {};
		}
	);

	let count = 0;
	const o = new C();

	autorun(() => {
		count++;
		o.value;
	});

	o.value = {};
	expect(count).toBe(2);
	expect(isObservable(o.value)).toBe(false);
});

test("properties can be further configured", () => {
	type Value = { valueA: number; valueB: number; comp: number };
	const C = observable.configure(
		{
			value: type.observable.configure<Value>({
				valueA: type.observable,
				comp: type.computed
			})
		},
		class {
			value = {
				valueA: 1,
				valueB: 2,
				count: 0,
				get comp() {
					this.count++;
					return this.valueA * 2;
				}
			};
		}
	);

	let count = 0;
	const o = new C();

	autorun(() => {
		count++;
		o.value.comp;
	});

	expect(isObservable(o.value)).toBe(true);
	expect(o.value.count).toBe(1);
	expect(o.value.comp).toBe(2);
	o.value.valueA = 2;
	expect(count).toBe(2);
	expect(o.value.comp).toBe(4);
	expect(o.value.count).toBe(2);
});

test("properties can be configured to be computed", () => {
	const C = observable.configure(
		{
			comp: type.computed,
			value: type.observable
		},
		class {
			value = 1;
			count = 0;

			get comp() {
				this.count++;
				return this.value * 2;
			}
		}
	);

	let count = 0;
	const o = new C();

	autorun(() => {
		o.comp;
		count++;
	});

	expect(o.count).toBe(1);

	o.value = 2;
	expect(o.count).toBe(2);
	expect(count).toBe(2);

	expect(o.comp).toBe(4);
	expect(o.count).toBe(2);
});

test("configuration can't be a function on classes", () => {
	expect(() =>
		observable.configure(
			(name, object) => {
				return undefined;
			},
			class {
				value = 1;
				nonObserved = 0;
				count = 0;

				get comp() {
					this.count++;
					return this.value * 2;
				}
			}
		)
	).toThrowError();
});

test("properties can be configured to be computed refs", () => {
	const C = observable.configure(
		{
			comp: type.computed,
			compNonRef: type.computed({ ref: false }),
			value: type.observable
		},
		class {
			value = 1;
			count = 0;

			get comp() {
				this.count++;
				return { value: this.value * 2 };
			}

			get compNonRef() {
				this.count++;
				return { value: this.value * 2 };
			}
		}
	);

	let count = 0;
	const o = new C();

	autorun(() => {
		o.comp;
		o.compNonRef;
		count++;
	});

	expect(o.count).toBe(2);

	o.value = 2;
	expect(o.count).toBe(4);
	expect(count).toBe(2);

	expect(o.comp).toEqual({ value: 4 });
	expect(o.compNonRef).toEqual({ value: 4 });
	expect(isObservable(o.comp)).toBe(false);
	expect(isObservable(o.compNonRef)).toBe(true);
});

test("properties can be configured to be actions", () => {
	const C = observable.configure(
		{
			valueA: type.observable,
			valueB: type.observable,
			action: type.action
		},
		class {
			valueA = 1;
			valueB = 1;

			action(val: number) {
				this.valueA = val;
				this.valueB = val;
			}

			notAction(val: number) {
				this.valueA = val;
				this.valueB = val;
			}
		}
	);

	const c = new C();
	enforceActions(true);
	let count = 0;

	autorun(() => {
		c.valueA;
		c.valueB;
		count++;
	});

	c.action(2);
	expect(count).toBe(2);
	expect(c.valueA).toBe(2);
	expect(c.valueB).toBe(2);

	expect(() => c.notAction(3)).toThrowError();
	enforceActions(false);
});

test("properties can be configured to be tasks", async () => {
	const C = observable.configure(
		{
			valueA: type.observable,
			valueB: type.observable,
			action: type.task
		},
		class {
			valueA = 1;
			valueB = 1;

			async action(val: number) {
				this.valueA = val;
				await task(Promise.resolve());
				this.valueB = val;
				this.valueA = val + 1;
			}
		}
	);

	const c = new C();
	enforceActions(true);
	let count = 0;

	autorun(() => {
		c.valueA;
		c.valueB;
		count++;
	});

	const p = c.action(2);
	expect(count).toBe(2);
	expect(c.valueA).toBe(2);
	expect(c.valueB).toBe(1);
	await p;
	expect(count).toBe(3);
	expect(c.valueA).toBe(3);
	expect(c.valueB).toBe(2);

	enforceActions(false);
});

test("configure with inherited class", () => {
	class Base {
		value = 1;
		get comp() {
			return this.value * 2;
		}

		action(n: number) {
			this.value = n;
		}
	}

	const C = observable.configure(
		{
			value: type.observable,
			comp: type.computed,
			action: type.action
		},
		class extends Base {}
	);

	const c = new C();

	enforceActions(true);
	let count = 0;

	autorun(() => {
		c.comp;
		count++;
	});

	c.action(2);
	expect(count).toBe(2);
	expect(c.value).toBe(2);
	expect(c.comp).toBe(4);
	enforceActions(false);
});

test("configure with inherited class (super)", () => {
	class Base {
		value = 1;
		get comp() {
			return this.value * 2;
		}

		action(n: number) {
			this.value *= n;
		}
	}

	const C = observable.configure(
		{
			value: type.observable,
			comp: type.computed,
			action: type.action
		},
		class extends Base {
			action(n: number) {
				super.action(n);
				this.value++;
			}
		}
	);

	const c = new C();

	enforceActions(true);
	let count = 0;

	autorun(() => {
		c.comp;
		count++;
	});

	c.action(2);
	expect(count).toBe(2);
	expect(c.value).toBe(3);
	expect(c.comp).toBe(6);
	enforceActions(false);
});

test("observable returns the configured instance", () => {
	class C {
		observable = {};
		nonObservable = {};
	}

	observable.configure(
		{
			observable: type.observable
		},
		C
	);

	const c = observable(new C());
	expect(isObservable(c.observable)).toBe(true);
	expect(isObservable(c.nonObservable)).toBe(false);
});

test("types are inherited by prototype on configured constructors", () => {
	class BaseA {
		baseAObservable = {};
		baseAOverwrite = {};
	}

	observable.configure(
		{
			baseAObservable: type.observable
		},
		BaseA
	);

	class BaseB extends BaseA {
		baseBObservable = {};
		baseBNonObservable = {};
	}

	observable.configure(
		{
			baseAOverwrite: type.observable,
			baseBObservable: type.observable
		},
		BaseB
	);

	class C extends BaseB {
		cObservable = {};
	}

	observable.configure({ cObservable: type.observable }, C);

	const c = observable(new C());

	expect(isObservable(c.baseAObservable)).toBe(true);
	expect(isObservable(c.baseAOverwrite)).toBe(true);
	expect(isObservable(c.baseBNonObservable)).toBe(false);
	expect(isObservable(c.baseBObservable)).toBe(true);
	expect(isObservable(c.cObservable)).toBe(true);
});

test("types are not inherited by prototype on non-configured constructors", () => {
	class BaseA {
		baseAObservable = {};
		baseNonObservable = {};
	}

	observable.configure(
		{
			baseAObservable: type.observable
		},
		BaseA
	);

	class BaseB extends BaseA {
		baseBObservable = {};
		baseBNonObservable = {};
	}

	observable.configure(
		{
			baseBObservable: type.observable
		},
		BaseB
	);

	const C = observable(
		class C extends BaseB {
			cObservable = {};
		}
	);

	const c = new C();

	// all true as we ignore all other configured objects
	expect(isObservable(c.baseAObservable)).toBe(true);
	expect(isObservable(c.baseNonObservable)).toBe(true);
	expect(isObservable(c.baseBNonObservable)).toBe(true);
	expect(isObservable(c.baseBObservable)).toBe(true);
	expect(isObservable(c.cObservable)).toBe(true);
});

test("instanceof operator on observable class and object", () => {
	class C {}
	const CO = observable(C);
	const c = new C();
	const co = new CO();
	expect(c).toBeInstanceOf(CO);
	expect(co).toBeInstanceOf(C);
	expect(co).toBeInstanceOf(CO);
});
