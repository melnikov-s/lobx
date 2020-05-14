import {
	autorun,
	observable,
	isObservable,
	type,
	enforceActions,
	getObservableSource
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

test("observable returns the configured instance", () => {
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

test("properties can be configured to be computed refs", () => {
	const C = observable.configure(
		{
			comp: type.computed,
			compRef: type.computedRef,
			value: type.observable
		},
		class {
			value = 1;
			count = 0;

			get comp() {
				this.count++;
				return { value: this.value * 2 };
			}

			get compRef() {
				this.count++;
				return { value: this.value * 2 };
			}
		}
	);

	let count = 0;
	const o = new C();

	autorun(() => {
		o.comp;
		o.compRef;
		count++;
	});

	expect(o.count).toBe(2);

	o.value = 2;
	expect(o.count).toBe(4);
	expect(count).toBe(2);

	expect(o.comp).toEqual({ value: 4 });
	expect(o.compRef).toEqual({ value: 4 });
	expect(isObservable(o.comp)).toBe(true);
	expect(isObservable(o.compRef)).toBe(false);
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
			valueB = 2;

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

test("properties can be configured to be async actions", async () => {
	function fetchNumber(n: number): Promise<number> {
		return new Promise(resolve => {
			setTimeout(() => resolve(n), 0);
		});
	}

	const C = observable.configure(
		{
			valueA: type.observable,
			valueB: type.observable,
			action: type.asyncAction
		},
		class {
			valueA = 1;
			valueB = 2;
			finished = false;

			async action(val: number) {
				this.valueA = val;
				this.valueB = val;
				const v = await fetchNumber(val + 1);
				this.valueA = v;
				this.valueB = v;
				const v2 = await fetchNumber(v + 1);
				this.valueA = v2;
				this.valueB = v2;
				this.finished = true;
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

	await c.action(2);
	expect(count).toBe(4);
	expect(c.valueA).toBe(4);
	expect(c.valueB).toBe(4);
	expect(c.finished).toBe(true);

	enforceActions(false);
});

test("async actions don't require returning promises", () => {
	const C = observable.configure(
		{
			valueA: type.observable,
			valueB: type.observable,
			action: type.asyncAction
		},
		class {
			valueA = 1;
			valueB = 2;

			action(val: number) {
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
