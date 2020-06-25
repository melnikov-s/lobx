import {
	observable,
	reaction,
	runInAction,
	autorun,
	computed,
	Observable,
	Computed,
	isObserved,
	onObservedStateChange
} from "../src";

test("can return a computed value", () => {
	const o = observable.box(1);
	const c = computed(() => o.get() * 2);
	expect(c.get()).toEqual(2);
});

test("can update automatically", () => {
	const o = observable.box(1);
	const c = computed(() => o.get() * 2);
	o.set(10);
	expect(c.get()).toEqual(20);
	o.set(1);
	expect(c.get()).toEqual(2);
});

test("will run each time when not listened to", () => {
	let count = 0;
	const o = observable.box(1);
	const c = computed(() => {
		count++;
		return o.get();
	});
	expect(count).toBe(0);
	c.get();
	expect(count).toBe(1);
	c.get();
	expect(count).toBe(2);
	c.get();
	expect(count).toBe(3);
});

test("will only used cached value when listened to", () => {
	let count = 0;
	const o = observable.box(1);
	const c = computed(() => {
		count++;
		return o.get();
	});
	const u = reaction(
		() => c.get(),
		() => {}
	);

	expect(count).toBe(1);
	c.get();
	expect(count).toBe(1);
	c.get();
	expect(count).toBe(1);

	u();
	c.get();
	expect(count).toBe(2);
});

test("will only used cached value when listened to (deep)", () => {
	let count = 0;
	const o = observable.box(1);
	const c1 = computed(() => {
		count++;
		return o.get();
	});
	const c2 = computed(() => {
		return c1.get();
	});

	const u = reaction(
		() => c2.get(),
		() => {}
	);

	expect(count).toBe(1);
	c1.get();
	expect(count).toBe(1);
	c1.get();
	expect(count).toBe(1);

	u();
	c1.get();
	expect(count).toBe(2);
});

test("will clear cached value when there are no listeners", () => {
	let countC = 0;
	let countA = 0;

	const o = observable.box(1);
	const c = computed(() => {
		countC++;
		return o.get();
	});

	let u = autorun(() => c.get());
	expect(countC).toBe(1);
	const u2 = autorun(() => c.get());
	c.get();
	expect(countC).toBe(1);
	u2();
	u();
	u = autorun(() => {
		c.get();
		countA++;
	});
	expect(countC).toBe(2);
	expect(countA).toBe(1);

	o.set(2);
	expect(countC).toBe(3);
	expect(countA).toBe(2);
	c.get();
	expect(countC).toBe(3);
});

test("will not trigger reaction on same value", () => {
	let countC = 0;
	let countR = 0;
	const o1 = observable.box(1);
	const o2 = observable.box(0);

	const c = computed(() => {
		countC++;
		return o1.get() * 0 + o2.get();
	});
	reaction(
		() => c.get(),
		() => countR++
	);

	expect(countC).toBe(1);
	o1.set(2);
	expect(countC).toBe(2);
	expect(countR).toBe(0);
	o2.set(1);
	expect(countC).toBe(3);
	expect(countR).toBe(1);
});

test("will not allow changing observable values within a computed", () => {
	const o1 = observable.box(0);
	const o2 = observable.box(1);
	const c1 = computed(() => {
		o2.set(3);
		return o1.get();
	});

	reaction(
		() => o2.get(),
		() => {}
	);
	expect(() =>
		reaction(
			() => c1.get(),
			() => {}
		)
	).toThrowError();
});

test("observable values only observed by the computed can change", () => {
	const c1 = computed(() => {
		const o1 = observable.box(0);
		o1.get();
		o1.set(1);
		return o1.get();
	});

	expect(() =>
		reaction(
			() => c1.get(),
			() => {}
		)
	).not.toThrow();
});

test("will allow creating new observable values within a computed", () => {
	const o1 = observable.box(0);
	let o2;
	const c = computed(() => {
		o2 = observable.box(0);
		o2.set(3);
		return o1.get();
	});
	expect(() =>
		reaction(
			() => c.get() + o2.get() + c.get(),
			() => {}
		)
	).not.toThrow();
});

test("will not react to observables created within the same computed", () => {
	let count = 0;
	const o1 = observable.box(2);
	let o2;
	const c = computed(() => {
		o2 = observable.box(3);
		o2.set(5);
		count++;
		return o1.get() * 2 * o2.get();
	});

	autorun(() => c.get());

	expect(count).toBe(1);
	expect(c.get()).toBe(20);
	expect(count).toBe(1);
	o2.set(10);
	expect(count).toBe(2);
});

test("will throw if an observable created within a computed is re-used", () => {
	let count = 0;
	const o1 = observable.box(2);
	let o2;
	const c = computed(() => {
		o2 = o2 || observable.box(3);
		o2.set(5);
		count++;
		return o1.get() * 2 * o2.get();
	});

	autorun(() => c.get());

	expect(count).toBe(1);

	runInAction(() => {
		o1.set(3);
		o1.set(2);
	});

	expect(count).toBe(1);

	expect(() => o2.set(10)).toThrowError();
});

test("can use an observable that was created in another computed", () => {
	let count = 0;
	let result = 0;
	const o1 = observable.box(2);
	let o2;
	const c1 = computed(() => {
		o2 = observable.box(3);

		const v = o2.get();
		return o1.get() * 2 * v;
	});

	const c2 = computed(() => {
		count++;
		return o2.get();
	});

	autorun(() => (result = c1.get() + c2.get()));
	expect(count).toBe(1);

	expect(result).toBe(15);

	o2.set(10);
	expect(count).toBe(2);

	expect(result).toBe(15);
});

test("can change what it is observing mid-action", () => {
	let count = 0;
	const o1 = observable.box(true);
	const o2 = observable.box(0);
	const o3 = observable.box(1);

	const c = computed(() => {
		count++;
		return o1.get() ? o2.get() : o3.get();
	});

	autorun(() => c.get());
	expect(count).toBe(1);
	expect(c.get()).toBe(0);
	expect(count).toBe(1);
	o2.set(-1);
	expect(count).toBe(2);
	o3.set(2);
	expect(count).toBe(2);
	expect(c.get()).toBe(-1);
	o1.set(false);
	expect(count).toBe(3);
	o2.set(-2);
	expect(count).toBe(3);
	o3.set(3);
	expect(count).toBe(4);
});

test("will clean up computed no longer in use", () => {
	let count1 = 0;
	let count2 = 0;
	const o1 = observable.box(true);
	const o2 = observable.box(1);
	const c0 = computed(() => {
		count2++;
		o2.get();
	});
	const c1 = computed(() => {
		count1++;
		return c0.get();
	});
	const c2 = computed(() => o2.get());

	autorun(() => (o1.get() ? c1.get() : c2.get()));
	expect(count1).toBe(1);
	expect(count2).toBe(1);
	c1.get();
	expect(count1).toBe(1);
	expect(count2).toBe(1);
	o1.set(false);
	expect(count1).toBe(1);
	expect(count2).toBe(1);
	c1.get();
	expect(count1).toBe(2);
	expect(count2).toBe(2);
});

test("will not run when an action produces a no-op", () => {
	let count = 0;
	const o1 = observable.box(1);
	const o2 = observable.box(2);
	const c = computed(() => {
		count++;
		return o1.get() + o2.get();
	});
	autorun(() => c.get());
	expect(count).toBe(1);
	runInAction(() => {
		o1.set(0);
		o2.set(0);
		o1.set(1);
		o2.set(2);
	});
	expect(count).toBe(1);
	expect(c.get()).toBe(3);
	expect(count).toBe(1);
});

test("will update after an action that changes an observer and no-ops another", () => {
	let count1 = 0;
	let count2 = 0;
	const o1 = observable.box(1);
	const o2 = observable.box(2);
	const c1 = computed(() => {
		count1++;
		return o1.get() + o2.get();
	});
	const c2 = computed(() => {
		count2++;
		return c1.get() + o1.get();
	});

	autorun(() => c2.get());
	expect(count1).toBe(1);
	expect(count2).toBe(1);

	runInAction(() => {
		o2.set(0);
		o1.set(0);
		o1.set(1);
	});

	expect(count1).toBe(2);
	expect(count2).toBe(2);
	expect(c2.get()).toBe(2);
	expect(c1.get()).toBe(1);
	expect(count1).toBe(2);
	expect(count2).toBe(2);
});

test("will observe sibling computed values", () => {
	const o = observable.box(1);
	const observables: (Observable<number> | Computed<number>)[] = [o];
	for (let i = 0; i < 10; i++) {
		observables.push(
			computed(function() {
				return observables[i].get() + 1;
			})
		);
	}

	const last = observables[observables.length - 1];
	reaction(
		() => last.get(),
		() => {}
	);
	expect(last.get()).toBe(11);

	o.set(2);
	expect(last.get()).toBe(12);
});

test("will cache values mid action", () => {
	let count1 = 0;
	let count2 = 0;
	let count3 = 0;
	const o1 = observable.box(1);
	const o2 = observable.box(2);
	const c1 = computed(() => {
		count1++;
		return o1.get() + o2.get();
	});
	const c2 = computed(() => {
		count2++;
		return c1.get() + o1.get();
	});

	const c3 = computed(() => {
		count3++;
		return o2.get();
	});

	autorun(() => c2.get() + c3.get());
	expect(count1).toBe(1);
	expect(count2).toBe(1);
	expect(count3).toBe(1);

	runInAction(() => {
		o2.set(0);
		expect(c2.get()).toBe(2);
		expect(c2.get()).toBe(2);
		expect(count1).toBe(2);
		expect(count2).toBe(2);
		expect(count3).toBe(1);
		expect(c3.get()).toBe(0);
		expect(c3.get()).toBe(0);
		expect(count3).toBe(2);
		o1.set(0);
		expect(c3.get()).toBe(0);
		expect(count3).toBe(2);
		expect(c2.get()).toBe(0);
		expect(c2.get()).toBe(0);
		expect(count1).toBe(3);
		expect(count2).toBe(3);
		o1.set(1);
	});

	expect(count1).toBe(4);
	expect(count2).toBe(4);
	expect(count3).toBe(2);

	expect(c1.get()).toBe(1);
	expect(c2.get()).toBe(2);
	expect(c3.get()).toBe(0);
});

test("will detect a cycle", () => {
	const o = observable.box(1);
	const c1 = computed(() => o.get() + c2.get());
	const c2 = computed(() => o.get() + c1.get());

	expect(() => c1.get()).toThrow(/cycle detected/);
});

test("can recover from computed error", () => {
	const o1 = observable.box(true);
	const o2 = observable.box(2);
	const c1 = computed(() => {
		if (o1.get()) {
			throw new Error("oops");
		} else {
			return o2.get();
		}
	});

	expect(() => autorun(() => c1.get())).toThrowError();
	o1.set(false);
	expect(c1.get()).toBe(2);
});

test("can create a computed inside of a computed", () => {
	let count = 0;
	let o2;
	let c2;
	let val;
	const o1 = observable.box(1);
	const c = computed(() => {
		o2 = observable.box(5);
		c2 = computed(() => o2.get());
		o2.set(10);
		return o1.get() + c2.get();
	});

	autorun(() => {
		count++;
		val = c.get() + c2.get();
	});

	expect(count).toBe(1);
	expect(val).toBe(21);
	o2.set(20);
	expect(c2.get()).toBe(10);
	expect(val).toBe(21);
	o1.set(5);
	expect(val).toBe(25);
	expect(count).toBe(3);
});

test("non observed computed will cache values while it's being evaluated", () => {
	let count = 0;
	const o = observable.box(0);
	const c1 = computed(() => {
		count++;
		return o.get();
	});
	const c2 = computed(() => c1.get() + c1.get());
	const c3 = computed(() => c2.get() + c2.get());

	c3.get();
	expect(count).toBe(1);
});

test("non observed will become dirty after it's evaluated", () => {
	const o = observable.box(0);
	const c1 = computed(() => {
		return o.get();
	});
	const c2 = computed(() => c1.get() + c1.get());
	const c3 = computed(() => c2.get() + c2.get());

	c3.get();
	expect(c1.isDirty()).toBe(true);
	expect(c2.isDirty()).toBe(true);
	expect(c3.isDirty()).toBe(true);

	autorun(() => c2.get());
	expect(c1.isDirty()).toBe(false);
	expect(c2.isDirty()).toBe(false);
	expect(c3.isDirty()).toBe(true);
});

test("computed is keptAlive even if not observed", () => {
	let count = 0;
	const o = observable.box(1);
	const c = computed(
		() => {
			count++;
			return o.get() * 2;
		},
		{ keepAlive: true }
	);

	expect(c.get()).toBe(2);
	expect(count).toBe(1);
	expect(c.get()).toBe(2);
	expect(count).toBe(1);
	o.set(10);
	expect(c.get()).toBe(20);
	expect(count).toBe(2);
});

test("keepAlive computed evaluates lazily", () => {
	let count = 0;
	const o = observable.box(1);
	const c = computed(
		() => {
			count++;
			return o.get() * 2;
		},
		{ keepAlive: true }
	);

	expect(count).toBe(0);
	o.set(10);
	expect(count).toBe(0);
	expect(c.get()).toBe(20);
	expect(count).toBe(1);
});

test("keep alive does not become unobserved", () => {
	let count = 0;
	const o = observable.box(1);
	const c1 = computed(
		() => {
			count++;
			return o.get() * 2;
		},
		{ keepAlive: true }
	);
	const c2 = computed(() => o.get() === 1 && c1.get());

	expect(c1.isDirty()).toBe(true);
	c2.get();
	expect(count).toBe(1);
	expect(c2.isDirty()).toBe(true);
	expect(c1.isDirty()).toBe(false);

	o.set(2);
	expect(c1.isDirty()).toBe(true);
	expect(c2.get()).toBe(false);
	expect(count).toBe(1);
	expect(c1.isDirty()).toBe(true);
	o.set(1);
	expect(count).toBe(1);
	autorun(() => c2.get());
	expect(count).toBe(2);
	o.set(2);
	expect(count).toBe(2);
	expect(c2.get()).toBe(false);
	expect(c1.isDirty()).toBe(true);
	expect(count).toBe(2);
	o.set(1);
	expect(count).toBe(3);
	expect(c1.isDirty()).toBe(false);
});

test("can unobserve a keepAlive computed manually", () => {
	let count = 0;
	const o = observable.box(1);
	const c1 = computed(
		() => {
			count++;
			return o.get() * 2;
		},
		{ keepAlive: true }
	);

	c1.get();
	expect(c1.isDirty()).toBe(false);
	c1.get();
	expect(count).toBe(1);
	c1.setKeepAlive(false);
	expect(c1.isDirty()).toBe(true);
	c1.setKeepAlive(true);
	expect(c1.get()).toBe(2);
	expect(c1.isDirty()).toBe(false);
});

test("can provide a custom equals function", () => {
	let countA = 0;
	let countB = 0;
	let countC = 0;
	const o = observable.box({ prop: 0 });
	const c = computed(
		() => {
			countA++;
			return o.get();
		},
		{
			equals: (a: any, b: any) => {
				countB++;
				return a.prop === b.prop;
			}
		}
	);
	autorun(() => {
		countC++;
		return c.get();
	});
	expect(countA).toBe(1);
	expect(countB).toBe(0);
	expect(countC).toBe(1);
	o.set({ prop: 1 });
	expect(countA).toBe(2);
	expect(countB).toBe(1);
	expect(countC).toBe(2);
	o.set({ prop: 2 });
	expect(countA).toBe(3);
	expect(countB).toBe(2);
	expect(countC).toBe(3);
	o.set({ prop: 2 });
	expect(countA).toBe(4);
	expect(countB).toBe(3);
	expect(countC).toBe(3);
	o.set({ prop: 1 });
	expect(countA).toBe(5);
	expect(countB).toBe(4);
	expect(countC).toBe(4);
});

test("correctly marks computed as potentially stale", () => {
	const o = observable.box(1);
	const c1 = computed(() => o.get() * 1);
	const c2 = computed(() => o.get() * 2);
	const c3 = computed(() => o.get() * 2);
	const c4 = computed(() => c2.get() + c3.get());
	const c5 = computed(() => c4.get());

	let result: number;

	autorun(() => (result = c1.get() + c5.get()));

	expect(result).toBe(5);
	o.set(2);
	expect(result).toBe(10);
});

test("sets the conext of the executing computed", () => {
	const context = {};
	const c = computed(
		function() {
			expect(this).toBe(context);
			return 1;
		},
		{ context }
	);

	expect(c.get()).toBe(1);
});

test("can change keepAlive once computed has been created", () => {
	let onBecomeUnobservedCount = 0;
	let onBecomeObservedCount = 0;
	const o = observable.box(1);

	onObservedStateChange(o, observing => {
		if (observing) {
			onBecomeObservedCount++;
		} else {
			onBecomeUnobservedCount++;
		}
	});
	const c = computed(() => o.get(), { keepAlive: true });

	expect(onBecomeObservedCount).toBe(0);
	expect(onBecomeUnobservedCount).toBe(0);

	c.get();
	expect(onBecomeObservedCount).toBe(1);
	expect(onBecomeUnobservedCount).toBe(0);

	expect(c.isDirty()).toBe(false);
	expect(isObserved(o)).toBe(true);
	c.setKeepAlive(false);
	expect(onBecomeObservedCount).toBe(1);
	expect(onBecomeUnobservedCount).toBe(1);
	expect(c.isDirty()).toBe(true);
	expect(isObserved(o)).toBe(false);
	c.get();
	expect(c.isDirty()).toBe(true);
	c.setKeepAlive(true);
	expect(c.isDirty()).toBe(true);
	c.get();
	expect(c.isDirty()).toBe(false);
	expect(isObserved(o)).toBe(true);
});

test("[mobx-test] computed values believe NaN === NaN", () => {
	const a = observable.box(2);
	const b = observable.box(3);
	const c = computed(function() {
		return a.get() * b.get();
	});
	const buf = [];
	reaction(
		() => c.get(),
		v => buf.push(v)
	);

	a.set(NaN);
	b.set(NaN);
	a.set(NaN);
	a.set(2);
	b.set(3);

	expect(buf).toEqual([NaN, 6]);
});

test("[mobx-test] lazy evaluation", function() {
	let bCalcs = 0;
	let cCalcs = 0;
	let dCalcs = 0;
	let observerChanges = 0;

	const a = observable.box(1);
	const b = computed(function() {
		bCalcs += 1;
		return a.get() + 1;
	});

	const c = computed(function() {
		cCalcs += 1;
		return b.get() + 1;
	});

	expect(bCalcs).toBe(0);
	expect(cCalcs).toBe(0);
	expect(c.get()).toBe(3);
	expect(bCalcs).toBe(1);
	expect(cCalcs).toBe(1);

	expect(c.get()).toBe(3);
	expect(bCalcs).toBe(2);
	expect(cCalcs).toBe(2);

	a.set(2);
	expect(bCalcs).toBe(2);
	expect(cCalcs).toBe(2);

	expect(c.get()).toBe(4);
	expect(bCalcs).toBe(3);
	expect(cCalcs).toBe(3);

	const d = computed(function() {
		dCalcs += 1;
		return b.get() * 2;
	});

	const handle = reaction(
		() => d.get(),
		function() {
			observerChanges += 1;
		}
	);
	expect(bCalcs).toBe(4);
	expect(cCalcs).toBe(3);
	expect(dCalcs).toBe(1); // d is evaluated, so that its dependencies are known

	a.set(3);
	expect(d.get()).toBe(8);
	expect(bCalcs).toBe(5);
	expect(cCalcs).toBe(3);
	expect(dCalcs).toBe(2);

	expect(c.get()).toBe(5);
	expect(bCalcs).toBe(5);
	expect(cCalcs).toBe(4);
	expect(dCalcs).toBe(2);

	expect(b.get()).toBe(4);
	expect(bCalcs).toBe(5);
	expect(cCalcs).toBe(4);
	expect(dCalcs).toBe(2);

	handle(); // unlisten
	expect(d.get()).toBe(8);
	expect(bCalcs).toBe(6); // gone to sleep
	expect(cCalcs).toBe(4);
	expect(dCalcs).toBe(3);

	expect(observerChanges).toBe(1);
});

test("[mobx-test] change count optimization", function() {
	let bCalcs = 0;
	let cCalcs = 0;
	const a = observable.box(3);
	const b = computed(function() {
		bCalcs += 1;
		return 4 + a.get() - a.get();
	});
	const c = computed(function() {
		cCalcs += 1;
		return b.get();
	});

	autorun(() => c.get());

	expect(b.get()).toBe(4);
	expect(c.get()).toBe(4);
	expect(bCalcs).toBe(1);
	expect(cCalcs).toBe(1);

	a.set(5);

	expect(b.get()).toBe(4);
	expect(c.get()).toBe(4);
	expect(bCalcs).toBe(2);
	expect(cCalcs).toBe(1);
});

test("[mobx-test] observables removed", function() {
	let calcs = 0;
	const a = observable.box(1);
	const b = observable.box(2);
	const c = computed(function() {
		calcs++;
		if (a.get() === 1) return b.get() * a.get() * b.get();
		return 3;
	});

	expect(calcs).toBe(0);
	autorun(() => c.get());
	expect(c.get()).toBe(4);
	expect(calcs).toBe(1);
	a.set(2);
	expect(c.get()).toBe(3);
	expect(calcs).toBe(2);

	b.set(3); // should not retrigger calc
	expect(c.get()).toBe(3);
	expect(calcs).toBe(2);

	a.set(1);
	expect(c.get()).toBe(9);
	expect(calcs).toBe(3);
});
