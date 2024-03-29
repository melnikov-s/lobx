import {
	autorun,
	observable,
	isObservable,
	enforceActions,
	computed,
	action,
	task,
	Observable,
	decorate,
	isInAction,
} from "../src/index";

afterEach(() => {
	enforceActions(false);
});

test("objects created from class are observable", () => {
	class C extends Observable {}

	const o = new C();
	expect(isObservable(o)).toBe(true);
});

test("objects create from class have observable properties", () => {
	class C extends Observable {
		value = "prop";
	}

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
	class C extends Observable {
		value = "prop";

		readValue() {
			return this.value;
		}
	}

	const o = new C();
	expect(o.readValue()).toBe("prop");
});

test("object methods occur in an action ", () => {
	enforceActions(true);
	class C extends Observable {
		valueA = 0;
		valueB = 0;

		inc() {
			this.valueA++;
			this.valueB++;
			expect(isInAction()).toBe(true);
		}
	}

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
	class C extends Observable {
		value = "prop";

		readValue() {
			return this.value;
		}
	}

	const o = new C();
	let count = 0;

	autorun(() => {
		o.readValue();
		count++;
	});

	o.value = "newProp";
	expect(count).toBe(2);
});

test("object setters occur in an action", () => {
	enforceActions(true);
	class C extends Observable {
		valueA = 0;
		valueB = 0;

		set values(v: number) {
			this.valueA = v;
			this.valueB = v;
			expect(isInAction()).toBe(true);
		}
	}

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

test("object getters and setters on same property", () => {
	enforceActions(true);
	class C extends Observable {
		valueA = 0;
		valueB = 0;

		get values() {
			return this.valueA + this.valueB;
		}

		set values(v: number) {
			this.valueA = v;
			this.valueB = v;
			expect(isInAction()).toBe(true);
		}
	}

	const o = new C();
	let count = 0;

	autorun(() => {
		o.values;
		count++;
	});

	o.values = 1;
	expect(count).toBe(2);
});

test("object getters return a value", () => {
	class C extends Observable {
		value = "prop";

		get readValue() {
			return this.value;
		}
	}

	const o = new C();
	expect(o.readValue).toBe("prop");
});

test("object getters are observable", () => {
	class C extends Observable {
		value = "prop";

		get readValue() {
			return this.value;
		}
	}

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
	class C extends Observable {
		value = Promise.resolve(42);
	}

	const o = new C();
	const v = await o.value;
	expect(v).toBe(42);
});

test("properties can not be reconfigured", () => {
	class C extends Observable {}

	decorate({}, C);
	expect(() => decorate({}, C)).toThrowError();
});

test("properties can not be reconfigured on an instance", () => {
	class C extends Observable {}
	decorate({}, C);
	const c = new C();
	expect(() => observable.configure({}, c)).toThrowError();
});

test("observable returns the configured class", () => {
	const C = class extends Observable {};
	const OC = decorate({}, C);
	expect(C).toBe(OC);
});

test("properties can be configured to be observable", () => {
	const C = decorate(
		{
			valueA: observable,
		},
		class extends Observable {
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
	const C = decorate(
		{},
		class extends Observable {
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
	const C = decorate(
		{
			value: observable.opts({ ref: true }),
		},
		class extends Observable {
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
	const C = decorate(
		{
			value: observable.configure<Value>({
				valueA: observable,
				comp: computed,
			}),
		},
		class extends Observable {
			value = {
				valueA: 1,
				valueB: 2,
				count: 0,
				get comp() {
					this.count++;
					return this.valueA * 2;
				},
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
	const C = decorate(
		{
			comp: computed,
			value: observable,
		},
		class extends Observable {
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
		decorate(
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			//@ts-ignore
			(name, object) => {
				return undefined;
			},
			class extends Observable {
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

test("properties can be configured to be actions", () => {
	const C = decorate(
		{
			valueA: observable,
			valueB: observable,
			action: action,
		},
		class extends Observable {
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
});

test("properties can be configured to be bound actions", () => {
	enforceActions(true);
	try {
		const O = decorate(
			{
				val: observable,
				inc: action.opts({ bound: true }),
			},
			class extends Observable {
				val = 0;
				inc() {
					expect(isInAction()).toBe(true);
					this.val++;
					this.val++;
				}
			}
		);

		let count = 0;
		const o = new O();

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

test("properties can be configured to be async actions", async () => {
	const C = decorate(
		{
			valueA: observable,
			valueB: observable,
			action: action,
		},
		class extends Observable {
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
});

test("configure with inherited class", () => {
	class Base extends Observable {
		value = 1;
		get comp() {
			return this.value * 2;
		}

		action(n: number) {
			this.value = n;
		}
	}

	const C = decorate(
		{
			value: observable,
			comp: computed,
			action: action,
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
});

test("configure with inherited class (super)", () => {
	class Base extends Observable {
		value = 1;
		get comp() {
			return this.value * 2;
		}

		action(n: number) {
			this.value *= n;
		}
	}

	const C = decorate(
		{
			value: observable,
			comp: computed,
			action: action,
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
});

test("observable returns the configured instance", () => {
	class C extends Observable {
		observable = {};
		nonObservable = {};
	}

	decorate(
		{
			observable: observable,
		},
		C
	);

	const c = observable(new C());
	expect(isObservable(c.observable)).toBe(true);
	expect(isObservable(c.nonObservable)).toBe(false);
});

test("types are inherited by prototype on configured constructors", () => {
	class BaseA extends Observable {
		baseAObservable = {};
		baseAOverwrite = {};
	}

	decorate(
		{
			baseAObservable: observable,
		},
		BaseA
	);

	class BaseB extends BaseA {
		baseBObservable = {};
		baseBNonObservable = {};
	}

	decorate(
		{
			baseAOverwrite: observable,
			baseBObservable: observable,
		},
		BaseB
	);

	class C extends BaseB {
		cObservable = {};
	}

	decorate({ cObservable: observable }, C);

	const c = observable(new C());

	expect(isObservable(c.baseAObservable)).toBe(true);
	expect(isObservable(c.baseAOverwrite)).toBe(true);
	expect(isObservable(c.baseBNonObservable)).toBe(false);
	expect(isObservable(c.baseBObservable)).toBe(true);
	expect(isObservable(c.cObservable)).toBe(true);
});

test("types are inherited by prototype on non-configured constructors", () => {
	class BaseA extends Observable {
		baseAObservable = {};
		baseNonObservable = {};
	}

	decorate(
		{
			baseAObservable: observable,
		},
		BaseA
	);

	class BaseB extends BaseA {
		baseBObservable = {};
		baseBNonObservable = {};
	}

	decorate(
		{
			baseBObservable: observable,
		},
		BaseB
	);

	class C extends BaseB {
		@observable cObservable = {
			foo: "bar",
		};
	}

	const c = new C();

	expect(isObservable(c.baseAObservable)).toBe(true);
	expect(isObservable(c.baseNonObservable)).toBe(false);
	expect(isObservable(c.baseBNonObservable)).toBe(false);
	expect(isObservable(c.baseBObservable)).toBe(true);
	expect(isObservable(c.cObservable)).toBe(true);
});

test("instanceof operator on observable class and object", () => {
	class C extends Observable {}
	const c = new C();
	expect(c).toBeInstanceOf(C);
});

test("constructor has observable instance", () => {
	const weakSet = new WeakSet();

	class C extends Observable {
		constructor() {
			super();
			weakSet.add(this);
			expect(isObservable(this)).toBe(true);
		}
		prop = {};
		arrowFunc = () => {
			expect(isObservable(this.prop)).toBe(true);
		};
	}
	decorate(
		{
			prop: observable,
		},
		C
	);

	const c = new C();
	c.arrowFunc();
	expect(weakSet.has(c)).toBe(true);
	expect.assertions(3);
});

test("can prevent Observable from being auto decorated", () => {
	class C extends Observable {
		prop = {};
		observed = {};
		constructor() {
			super({ configuration: { observed: observable } });
		}
	}

	const c = new C();
	expect(isObservable(c.prop)).toBe(false);
	expect(isObservable(c.observed)).toBe(true);
	expect(isObservable(c)).toBe(true);
});
