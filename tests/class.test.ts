import { autorun, observable, isObservable } from "../src/index";

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
