import {
	atom,
	observable,
	onBecomeObserved,
	onBecomeUnobserved,
	autorun,
	computed,
	runInAction
} from "../src";

const ObjectCase = {
	name: "Object",
	obj: observable({ value: 1 }),
	get getterA() {
		return this.obj.value;
	},
	get getterB() {
		return "value" in this.obj;
	}
};

const ArrayCase = {
	name: "Array",
	obj: observable([1, 2, 3]),
	get getterA() {
		return this.obj.forEach(() => {});
	},
	get getterB() {
		return this.obj[0];
	}
};

const SetCase = {
	name: "Set",
	obj: observable(new Set([1, 2, 3])),
	get getterA() {
		return this.obj.has(4);
	},
	get getterB() {
		return this.obj.has(2);
	}
};

const MapCase = {
	name: "Map",
	obj: observable(
		new Map([
			[1, 1],
			[2, 2],
			[3, 3]
		])
	),
	get getterA() {
		return this.obj.has(4);
	},
	get getterB() {
		return this.obj.get(2);
	}
};

const DateCase = {
	name: "Date",
	obj: observable(new Date()),
	get getterA() {
		return this.obj.getDate();
	},
	get getterB() {
		return this.obj.toDateString();
	}
};

[ObjectCase, ArrayCase, SetCase, MapCase, DateCase].forEach(testCase => {
	test(`onBecomeObserved on ${testCase.name}`, () => {
		let count = 0;

		const u = onBecomeObserved(testCase.obj, () => count++);
		expect(count).toBe(0);

		const u1 = autorun(() => testCase.getterA);
		expect(count).toBe(1);
		const u2 = autorun(() => testCase.getterA);
		expect(count).toBe(1);
		u1();
		u2();
		const u3 = autorun(() => testCase.getterB);
		expect(count).toBe(2);
		u3();
		testCase.getterB;
		expect(count).toBe(2);
		u();
		const u4 = autorun(() => {
			testCase.getterA;
			testCase.getterB;
		});
		expect(count).toBe(2);
		u4();
	});

	test(`onBecomeUnobserved on ${testCase.name}`, () => {
		let count = 0;

		const u = onBecomeUnobserved(testCase.obj, () => count++);
		expect(count).toBe(0);

		const u1 = autorun(() => testCase.getterA);
		expect(count).toBe(0);
		const u2 = autorun(() => testCase.getterA);
		expect(count).toBe(0);
		u1();
		expect(count).toBe(0);
		u2();
		expect(count).toBe(1);
		const u3 = autorun(() => testCase.getterB);
		expect(count).toBe(1);
		u3();
		expect(count).toBe(2);
		u();
		const u4 = autorun(() => {
			testCase.getterA;
			testCase.getterB;
		});
		u4();
		expect(count).toBe(2);
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
		keepAlive: true
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
			keepAlive: true
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
