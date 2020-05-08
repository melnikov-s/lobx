import { observable, computed, autorun, atom, runInAction } from "../src";

const createValueAtom = (v, onBecomeObserved?, onBecomeUnobserved?) => {
	const n = atom({ onBecomeObserved, onBecomeUnobserved });
	let value = v;

	return {
		set(v) {
			value = v;
			n.reportChanged();
		},
		get() {
			n.reportObserved();
			return value;
		}
	};
};

describe("atom test", () => {
	it("can be observed", () => {
		let count = 0;
		const a = createValueAtom(1);
		const c = computed(() => {
			count++;
			return a.get() * 2;
		});

		autorun(() => c.get());
		expect(count).toBe(1);
		expect(c.get()).toBe(2);
		expect(count).toBe(1);
		a.set(2);
		expect(c.get()).toBe(4);
		expect(count).toBe(2);
	});

	it("will trigger onBecomeObserved when observation starts", () => {
		let count = 0;
		const a = createValueAtom(1, () => count++);
		const c = computed(() => a.get());
		c.get();
		expect(count).toBe(1);
		const u = autorun(() => c.get());
		const u2 = autorun(() => a.get());
		expect(count).toBe(2);
		u();
		c.get();
		expect(count).toBe(2);
		u2();
		expect(count).toBe(2);
		autorun(() => c.get());
		expect(count).toBe(3);
	});

	it("will trigger onBecomeUnobserved when observation ends (listener unsbuscribe)", () => {
		let count = 0;
		const a = createValueAtom(1, null, () => count++);
		const c = computed(() => a.get());
		c.get();
		expect(count).toBe(1);
		let u = autorun(() => c.get());
		const u2 = autorun(() => a.get());
		expect(count).toBe(1);
		u();
		expect(count).toBe(1);
		u2();
		expect(count).toBe(2);
		u = autorun(() => c.get());
		expect(count).toBe(2);
		u();
		expect(count).toBe(3);
	});

	it("will trigger onBecomeUnobserved when observation ends (computed unsubscribe)", () => {
		let count = 0;
		const o = observable.box(true);
		const a = createValueAtom(1, null, () => count++);
		const c = computed(() => o.get() && a.get());
		const c2 = computed(() => c.get());
		c2.get();
		expect(count).toBe(1);
		autorun(() => c2.get());
		expect(count).toBe(1);
		o.set(false);
		expect(count).toBe(2);
	});

	it("will return a boolean indicating if atom is observed when invoking `reportObserved`", () => {
		const a = atom();
		expect(a.reportObserved()).toBe(false);
		const u = autorun(() => expect(a.reportObserved()).toBe(true));
		expect(a.reportObserved()).toBe(true);
		u();
		expect(a.reportObserved()).toBe(false);
	});

	it("will not trigger listeners unless 'reportChanged' is called", () => {
		let count = 0;

		const a = createValueAtom(1);
		const o = observable.box(1);
		const c = computed(() => ({
			n: a.get(),
			o: o.get()
		}));

		autorun(() => {
			count++;
			c.get();
		});

		expect(count).toBe(1);
		runInAction(() => {
			o.set(2);
			o.set(1);
		});

		expect(count).toBe(1);
	});

	// from mobx
	it("ensure onBecomeObserved and onBecomeUnobserved are only called when needed", () => {
		let start = 0;
		let stop = 0;
		let runs = 0;

		const a = atom({
			onBecomeObserved: () => start++,
			onBecomeUnobserved: () => stop++
		});
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

	it("unoptimizable subscriptions are diffed correctly", () => {
		const a = observable.box(1);
		const b = observable.box(1);
		const c = computed(() => {
			a.get();
			return 3;
		});
		let called = 0;
		let val = 0;

		const d = autorun(() => {
			called++;
			a.get();
			c.get(); // reads a as well
			val = a.get();
			if (
				b.get() === 1 // only on first run
			)
				a.get(); // second run: one read less for a
		});

		expect(called).toBe(1);
		expect(val).toBe(1);

		b.set(2);

		expect(called).toBe(2);
		expect(val).toBe(1);

		a.set(2);

		expect(called).toBe(3);
		expect(val).toBe(2);

		d();
	});

	it("can set a custom equals method", () => {
		const a = atom({ equals: a => a === 1 });

		let count = 0;

		autorun(() => {
			count++;
			a.reportObserved();
		});

		a.reportChanged();
		expect(count).toBe(2);
		a.reportChanged(0);
		expect(count).toBe(3);
		a.reportChanged(1);
		expect(count).toBe(3);
	});
});
