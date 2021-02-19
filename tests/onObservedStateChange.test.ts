import {
	atom,
	observable,
	onObservedStateChange,
	autorun,
	computed,
	runInAction,
} from "../src";

const onBecomeObserved = (o, ...args: any[]) =>
	onObservedStateChange(
		o,
		args[1] ? args[0] : (observing) => observing && args[0](),
		args[1] ? (observing) => observing && args[1]() : undefined
	);
const onBecomeUnobserved = (o, ...args: any[]) =>
	onObservedStateChange(
		o,
		args[1] ? args[0] : (observing) => !observing && args[0](),
		args[1] ? (observing) => !observing && args[1]() : undefined
	);
const objectCase = () => ({
	obj: observable({ value: 1, valueAlt: 2 }),
	existingKey: "value",
	existingKeyAlt: "valueAlt",
	notExistingKey: "noValue",
	get(k = this.existingKey) {
		return this.obj[k];
	},
	add(k, v) {
		this.obj[k] = v;
	},
});
objectCase.label = "object";

const arrayCase = () => ({
	obj: observable([1, 2, 3]),
	get() {
		return this.obj[0];
	},
});
arrayCase.label = "array";

const setCase = () => ({
	obj: observable(new Set([1, 2, 3])),
	existingKey: 1,
	existingKeyAlt: 2,
	notExistingKey: 4,
	get() {
		return this.obj.forEach(() => {});
	},
});
setCase.label = "set";

const mapCase = () => ({
	obj: observable(
		new Map([
			[1, 1],
			[2, 2],
			[3, 3],
		])
	),
	existingKey: 1,
	existingKeyAlt: 2,
	notExistingKey: 4,
	get(k = this.existingKey) {
		return this.obj.get(k);
	},
	add(k, v) {
		this.obj.set(k, v);
	},
});
mapCase.label = "map";

const dateCase = () => ({
	obj: observable(new Date()),
	get() {
		return this.obj.getDate();
	},
});
dateCase.label = "date";

[objectCase, arrayCase, setCase, mapCase, dateCase].forEach((TestCase) => {
	test(`onBecomeObserved on ${TestCase.label}`, () => {
		const testCase = TestCase();
		let count = 0;

		const u = onBecomeObserved(testCase.obj, () => count++);
		expect(count).toBe(0);

		const u1 = autorun(() => testCase.get());
		expect(count).toBe(1);
		const u2 = autorun(() => testCase.get());
		expect(count).toBe(1);
		u1();
		u2();
		const u3 = autorun(() => testCase.get());
		expect(count).toBe(2);
		u3();
		testCase.get();
		expect(count).toBe(2);
		u();
		const u4 = autorun(() => {
			testCase.get();
			testCase.get();
		});
		expect(count).toBe(2);
	});

	test(`onBecomeUnobserved on ${TestCase.label}`, () => {
		const testCase = TestCase();
		let count = 0;

		const u = onBecomeUnobserved(testCase.obj, () => count++);
		expect(count).toBe(0);

		const u1 = autorun(() => testCase.get());
		expect(count).toBe(0);
		const u2 = autorun(() => testCase.get());
		expect(count).toBe(0);
		u1();
		expect(count).toBe(0);
		u2();
		expect(count).toBe(1);
		const u3 = autorun(() => testCase.get());
		expect(count).toBe(1);
		u3();
		expect(count).toBe(2);
		u();
		const u4 = autorun(() => {
			testCase.get();
			testCase.get();
		});
		u4();
		expect(count).toBe(2);
	});
});

[objectCase, mapCase].forEach((TestCase) => {
	test(`onBecomeObserved on ${TestCase.label} with existing key`, () => {
		const testCase = TestCase();
		let count = 0;
		onBecomeObserved(testCase.obj, testCase.existingKey, () => {
			count++;
		});
		expect(count).toBe(0);
		autorun(() => testCase.get(testCase.existingKeyAlt));
		expect(count).toBe(0);
		const u2 = autorun(() => testCase.get(testCase.existingKey));
		expect(count).toBe(1);
		u2();
		expect(count).toBe(1);
		autorun(() => testCase.get(testCase.existingKey));
		expect(count).toBe(2);
	});

	test(`onBecomeObserved on ${TestCase.label} with non-existing key`, () => {
		const testCase = TestCase();
		let count = 0;
		onBecomeObserved(testCase.obj, testCase.notExistingKey, () => {
			count++;
		});
		expect(count).toBe(0);
		autorun(() => testCase.get(testCase.existingKey));
		expect(count).toBe(0);
		const u2 = autorun(() => testCase.get(testCase.notExistingKey));
		expect(count).toBe(0);
		testCase.add(testCase.notExistingKey, 1);
		expect(count).toBe(1);
		u2();
		expect(count).toBe(1);
		autorun(() => testCase.get(testCase.notExistingKey));
		expect(count).toBe(2);
	});

	test(`onBecomeUnobserved on ${TestCase.label} with existing key`, () => {
		const testCase = TestCase();
		let count = 0;
		onBecomeUnobserved(testCase.obj, testCase.existingKey, () => {
			count++;
		});
		expect(count).toBe(0);
		const u1 = autorun(() => testCase.get(testCase.existingKeyAlt));
		u1();
		expect(count).toBe(0);
		const u2 = autorun(() => testCase.get(testCase.existingKey));
		expect(count).toBe(0);
		u2();
		expect(count).toBe(1);
		const u3 = autorun(() => testCase.get(testCase.existingKey));
		expect(count).toBe(1);
		u3();
		expect(count).toBe(2);
	});

	test(`onBecomeUnobserved on ${TestCase.label} with non-existing key`, () => {
		const testCase = TestCase();
		let count = 0;
		onBecomeUnobserved(testCase.obj, testCase.notExistingKey, () => {
			count++;
		});
		expect(count).toBe(0);
		const u1 = autorun(() => testCase.get(testCase.existingKey));
		u1();
		expect(count).toBe(0);
		const u2 = autorun(() => testCase.get(testCase.notExistingKey));
		u2();
		expect(count).toBe(0);
		const u3 = autorun(() => testCase.get(testCase.notExistingKey));
		testCase.add(testCase.notExistingKey, 1);
		u3();
		expect(count).toBe(1);
	});
});

test("computed accepts a onBecomeObserved/onBecomeUnobserved callbacks", () => {
	let countObserved = 0;
	let countUnObserved = 0;

	const o = observable.box(0);
	const c = computed(() => o.get());
	onBecomeObserved(c, () => countObserved++);
	onBecomeUnobserved(c, () => countUnObserved++);
	expect(countObserved).toBe(0);
	expect(countUnObserved).toBe(0);

	const u = autorun(() => {
		c.get();
	});

	expect(countObserved).toBe(1);
	expect(countUnObserved).toBe(0);

	u();

	expect(countObserved).toBe(1);
	expect(countUnObserved).toBe(1);

	const u2 = autorun(() => {
		c.get();
	});

	expect(countObserved).toBe(2);
	expect(countUnObserved).toBe(1);

	u2();

	expect(countObserved).toBe(2);
	expect(countUnObserved).toBe(2);

	const bool = observable.box(true);

	autorun(() => {
		bool.get() && c.get();
	});

	expect(countObserved).toBe(3);
	expect(countUnObserved).toBe(2);

	bool.set(false);

	expect(countObserved).toBe(3);
	expect(countUnObserved).toBe(3);

	bool.set(true);

	expect(countObserved).toBe(4);
	expect(countUnObserved).toBe(3);
});
test("computed calls `onBecomeObserved` / `onBecomeUnobserved` after completed action", () => {
	let oObserved = 0;
	let oUnobserved = 0;
	let c1Observed = 0;
	let c1Unobserved = 0;
	let c2Observed = 0;
	let c2Unobserved = 0;

	const o = observable.box(1);

	onBecomeObserved(o, () => oObserved++);
	onBecomeUnobserved(o, () => oUnobserved++);

	const c1 = computed(() => o.get() * 2);
	onBecomeObserved(c1, () => c1Observed++);
	onBecomeUnobserved(c1, () => c1Unobserved++);

	const c2 = computed(() => c1.get() * 2, {});

	onBecomeObserved(c2, () => c2Observed++);
	onBecomeUnobserved(c2, () => c2Unobserved++);

	runInAction(() => {
		o.set(2);
		expect(c2.get()).toBe(8);
	});

	expect(oObserved).toBe(1);
	expect(oUnobserved).toBe(1);
	expect(c1Observed).toBe(1);
	expect(c1Unobserved).toBe(1);
	expect(c2Observed).toBe(0);
	expect(c2Unobserved).toBe(0);
});

test("computed calls `onBecomeObserved` / `onBecomeUnobserved` in a computed derivation", () => {
	let count = 0;
	const o = observable.box(1);
	onBecomeObserved(o, () => count++);
	onBecomeUnobserved(o, () => count++);
	const c1 = computed(() => o.get() * 2);
	onBecomeObserved(c1, () => count++);
	onBecomeUnobserved(c1, () => count++);

	const c2 = computed(() => o.get());
	onBecomeObserved(c2, () => count++);
	onBecomeUnobserved(c2, () => count++);

	const c3 = computed(() => c1.get() * 2 > 0 && c2.get(), {
		keepAlive: true,
	});

	onBecomeObserved(c3, () => count++);
	onBecomeUnobserved(c3, () => count++);

	expect(c3.get()).toBe(1);
	o.set(0);
	expect(c3.get()).toBe(false);

	expect(count).toBe(4);
});

test("calls unBecomeObserved/onBecomeUnobserved to nodes observed by keepAlive computed", () => {
	let count = 0;
	let deriveCount = 0;
	const o = observable.box(1);
	onBecomeObserved(o, () => count++);
	onBecomeUnobserved(o, () => count++);
	const c = computed(
		() => {
			deriveCount++;
			return o.get() * 2;
		},
		{
			keepAlive: true,
		}
	);
	onBecomeObserved(c, () => count++);
	onBecomeUnobserved(c, () => count++);

	// derive the computed first so that it's cached
	c.get();

	expect(count).toBe(1);
	const u = autorun(() => c.get()); // should be observed now
	u();

	expect(count).toBe(3);
	expect(deriveCount).toBe(1);
});

test("observable box accepts a onBecomeObserved/onBecomeUnobserved callbacks", () => {
	let countObserved = 0;
	let countUnObserved = 0;

	const o = observable.box(0);
	onBecomeObserved(o, () => countObserved++);
	onBecomeUnobserved(o, () => countUnObserved++);
	expect(countObserved).toBe(0);
	expect(countUnObserved).toBe(0);

	const u = autorun(() => {
		o.get();
	});

	expect(countObserved).toBe(1);
	expect(countUnObserved).toBe(0);

	u();

	expect(countObserved).toBe(1);
	expect(countUnObserved).toBe(1);

	const u2 = autorun(() => {
		o.get();
	});

	expect(countObserved).toBe(2);
	expect(countUnObserved).toBe(1);

	u2();

	expect(countObserved).toBe(2);
	expect(countUnObserved).toBe(2);
});

test("onObservedStateChange can be unsubed within the callback", () => {
	const o = observable.box(1);
	let count = 0;
	const unsub = onObservedStateChange(o, () => {
		count++;
		if (count === 4) {
			unsub();
		}
	});

	const u = autorun(() => o.get());
	expect(count).toBe(1);
	u();
	expect(count).toBe(2);
	const u2 = autorun(() => o.get());
	expect(count).toBe(3);
	u2();
	expect(count).toBe(4);
	const u3 = autorun(() => o.get());
	expect(count).toBe(4);
	u3();
	expect(count).toBe(4);
});

test("onObservedStateChange works with computed getters on objects", () => {
	let count = 0;
	const o = observable({
		value: 1,
		get comp() {
			return o.value * 2;
		},
	});

	onObservedStateChange(o, "comp", () => count++);
	expect(count).toBe(0);
	const unsub = autorun(() => o.comp);
	expect(count).toBe(1);
	unsub();
	expect(count).toBe(2);
});

test("[mobx-test] ensure onBecomeObserved and onBecomeUnobserved are only called when needed", () => {
	let start = 0;
	let stop = 0;
	let runs = 0;

	const a = atom();
	onBecomeObserved(a, () => start++);
	onBecomeUnobserved(a, () => stop++);
	expect(a.reportObserved()).toEqual(false);

	expect(start).toBe(0);
	expect(stop).toBe(0);

	let d = autorun(() => {
		runs++;
		expect(a.reportObserved()).toBe(true);
		expect(start).toBe(1);
		expect(a.reportObserved()).toBe(true);
		expect(start).toBe(1);
	});

	expect(runs).toBe(1);
	expect(start).toBe(1);
	expect(stop).toBe(0);
	a.reportChanged();
	expect(runs).toBe(2);
	expect(start).toBe(1);
	expect(stop).toBe(0);

	d();
	expect(runs).toBe(2);
	expect(start).toBe(1);
	expect(stop).toBe(1);

	expect(a.reportObserved()).toBe(false);
	expect(start).toBe(1);
	expect(stop).toBe(1);

	d = autorun(() => {
		expect(a.reportObserved()).toBe(true);
		expect(start).toBe(2);
		a.reportObserved();
		expect(start).toBe(2);
	});

	expect(start).toBe(2);
	expect(stop).toBe(1);
	a.reportChanged();
	expect(start).toBe(2);
	expect(stop).toBe(1);

	d();
	expect(stop).toBe(2);
});
