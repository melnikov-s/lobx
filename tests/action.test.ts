import { observable, runInAction, action, autorun, computed } from "../src";

test("immediately executes the function passed in", () => {
	let count = 0;
	runInAction(() => count++);
	expect(count).toBe(1);
});

test("updates observable values", () => {
	const o = observable.box(0);
	runInAction(() => o.set(1));
	expect(o.get()).toBe(1);
});

test("runInAction returns the result of the action", () => {
	expect(runInAction(() => 1)).toBe(1);
});

test("only calls reactions when the action is completed", () => {
	const o1 = observable.box(0);
	const o2 = observable.box(0);
	let result = 0;
	let count = 0;
	autorun(() => {
		result = o1.get() + o2.get();
		count++;
	});

	expect(count).toBe(1);

	runInAction(() => {
		o1.set(1);
		expect(result).toBe(0);
		o2.set(2);
		expect(result).toBe(0);
		expect(count).toBe(1);
	});

	expect(result).toBe(3);
	expect(count).toBe(2);
});

test("action is untracked", () => {
	let count = 0;
	const o = observable.box(0);

	autorun(() => {
		runInAction(() => o.get());
		count++;
	});

	expect(count).toBe(1);
	o.set(1);
	expect(count).toBe(1);
});

test("computed values are updated within an action", () => {
	let countC = 0;
	let countA = 0;
	const o1 = observable.box(0);
	const o2 = observable.box(0);
	const c = computed(() => {
		countC++;
		return o1.get() + o2.get();
	});
	autorun(() => {
		c.get();
		countA++;
	});
	expect(countC).toBe(1);
	expect(countA).toBe(1);

	runInAction(() => {
		expect(c.get()).toBe(0);
		expect(countC).toBe(1);
		o1.set(1);
		expect(c.get()).toBe(1);
		expect(countA).toBe(1);
		expect(countC).toBe(2);
		o2.set(2);
		expect(c.get()).toBe(3);
		expect(countC).toBe(3);
	});

	expect(countA).toBe(2);
	expect(c.get()).toBe(3);
	expect(countC).toBe(3);
});

test("does not trigger a change when an observable did not end up producing a new value", () => {
	let count = 0;
	const o = observable.box(0);
	const c = computed(() => o.get() * 2);

	autorun(() => {
		c.get();
		count++;
	});

	expect(count).toBe(1);

	runInAction(() => {
		o.set(1);
		o.set(0);
	});

	expect(count).toBe(1);
});

test("can create an action to execute at any time", () => {
	const o1 = observable.box(0);
	const o2 = observable.box(0);
	let result = 0;
	let count = 0;
	autorun(() => {
		result = o1.get() + o2.get();
		count++;
	});

	expect(count).toBe(1);

	const myAction = action(() => {
		o1.set(1);
		expect(result).toBe(0);
		o2.set(2);
		expect(result).toBe(0);
		expect(count).toBe(1);
	});

	myAction();

	expect(result).toBe(3);
	expect(count).toBe(2);
});

test("created action returns the result of the action", () => {
	const myAction = action(() => 1);
	expect(myAction()).toBe(1);
});

test("can execute an action within an action", () => {
	let countC = 0;
	let countA = 0;
	const o1 = observable.box(0);
	const o2 = observable.box(0);
	const c = computed(() => {
		countC++;
		return o1.get() + o2.get();
	});
	autorun(() => {
		c.get();
		countA++;
	});
	expect(countC).toBe(1);
	expect(countA).toBe(1);

	runInAction(() => {
		expect(c.get()).toBe(0);
		expect(countC).toBe(1);
		o1.set(1);
		expect(c.get()).toBe(1);
		expect(countA).toBe(1);
		expect(countC).toBe(2);
		runInAction(() => {
			runInAction(() => o2.set(2));
			o1.set(10);
		});
		expect(countA).toBe(1);
		expect(c.get()).toBe(12);
		expect(countC).toBe(3);
		runInAction(() => o1.set(2));
		expect(c.get()).toBe(4);
		expect(countC).toBe(4);
		expect(countA).toBe(1);
	});

	expect(countA).toBe(2);
});

test("computed values are cached in actions even when unonbserved", () => {
	let calls = 0;

	const o = observable.box(1);
	const c = computed(() => {
		calls++;
		return o.get() * o.get();
	});
	const doAction = action(() => {
		c.get();
		c.get();
		for (let i = 0; i < 10; i++) o.set(o.get() + 1);
	});

	doAction();
	expect(calls).toBe(1);

	doAction();
	expect(calls).toBe(2);

	autorun(() => c.get());
	expect(calls).toBe(3);

	doAction();
	expect(calls).toBe(4);
});

test("unobserved computed values do not empty cache until all actions are done", () => {
	let calls = 0;
	let called = false;

	const o1 = observable.box(0);

	const c = computed(() => {
		calls++;
		return { zero: o1.get() * 0 };
	});

	const doAction1 = action(() => {
		called = true;
		o1.set(o1.get() + 1);
		c.get();
		c.get();
	});

	const doAction2 = action(() => {
		c.get();
		c.get();
	});

	autorun(() => {
		o1.get();
		if (called) doAction2();
		c.get();
	});

	doAction1();

	expect(calls).toBe(2);
});

test("unobserved computed values respond to changes within an action", () => {
	const o = observable.box(1);
	const c = computed(() => {
		return o.get() * o.get();
	});
	const doAction = action(() => {
		expect(c.get()).toBe(1);
		o.set(10);
		expect(c.get()).toBe(100);
	});

	doAction();
	expect(c.get()).toBe(100);
});

test("computed can throw within an action", () => {
	const o = observable.box(1);
	const c = computed(() => {
		if (o.get() === 0) {
			throw new Error();
		}

		return o.get();
	});

	let count = 0;

	autorun(() => {
		count++;
		c.get();
	});

	expect(count).toBe(1);

	runInAction(() => {
		try {
			o.set(0);
			c.get();
		} catch (e) {}
		expect(() => c.get()).toThrowError();
		o.set(10);
	});

	expect(count).toBe(2);
	expect(c.get()).toBe(10);
});

test("[mobx-test] action in autorun does keep / make computed values alive", () => {
	let calls = 0;
	const myComputed = computed(() => calls++);
	const callComputedTwice = () => {
		myComputed.get();
		myComputed.get();
	};

	const runWithMemoizing = fun => {
		autorun(fun)();
	};

	callComputedTwice();
	expect(calls).toBe(2);

	runWithMemoizing(callComputedTwice);
	expect(calls).toBe(3);

	callComputedTwice();
	expect(calls).toBe(5);

	runWithMemoizing(function() {
		runInAction(callComputedTwice);
	});
	expect(calls).toBe(6);

	callComputedTwice();
	expect(calls).toBe(8);
});
