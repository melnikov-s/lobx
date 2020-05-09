import {
	observable,
	isInAction,
	runInAction,
	autorun,
	computed,
	listener,
	graph,
	untracked,
	atom,
	isObserved,
	isTracking
} from "../src";

describe("graph tests", () => {
	it("can't listen to untracked changes", () => {
		let count = 0;
		const l = listener(() => count++);
		const o = observable.box(0);
		const o2 = observable.box(1);
		expect(count).toBe(0);
		l.track(() => o.get() + untracked(() => o2.get()));
		o.set(1);
		expect(count).toBe(1);
		o2.set(2);
		expect(count).toBe(1);
		o.set(3);
		expect(count).toBe(2);
	});

	it("can't listen to untracked changes (non default graph)", () => {
		const g = graph();
		const opts = { graph: g };
		let count = 0;
		const l = listener(() => count++, opts);
		const o = observable.box(0, opts);
		const o2 = observable.box(1, opts);
		expect(count).toBe(0);
		l.track(() => o.get() + g.untracked(() => o2.get()));
		o.set(1);
		expect(count).toBe(1);
		o2.set(2);
		expect(count).toBe(1);
		o.set(3);
		expect(count).toBe(2);
	});

	it("can query graph action state", () => {
		expect(isInAction()).toBe(false);

		runInAction(() => {
			expect(isInAction()).toBe(true);
		});

		expect(isInAction()).toBe(false);
	});

	it("can query the observed state of an observable", () => {
		const o = observable.box(0);
		const c = computed(() => o.get());
		const n = atom();

		expect(isObserved(o)).toBe(false);
		expect(isObserved(c)).toBe(false);
		expect(isObserved(n)).toBe(false);

		const u = autorun(() => {
			c.get();
			n.reportObserved();
		});

		expect(isObserved(o)).toBe(true);
		expect(isObserved(c)).toBe(true);
		expect(isObserved(n)).toBe(true);

		u();

		expect(isObserved(o)).toBe(false);
		expect(isObserved(c)).toBe(false);
		expect(isObserved(n)).toBe(false);
	});

	it("can isolate observable state to a new graph", () => {
		const g = graph();
		const o = observable.box(0, { graph: g });
		const c = computed(() => o.get(), { graph: g });
		const a = atom({ graph: g });

		let count = 0;

		const u = autorun(() => {
			c.get();
			a.reportObserved();
			count++;
		});

		expect(count).toBe(1);
		o.set(1);
		a.reportChanged();
		expect(count).toBe(1);
		u();

		autorun(
			() => {
				c.get();
				a.reportObserved();
				expect(g.isTracking()).toBe(true);
				count++;
			},
			{ graph: g }
		);

		o.set(1);
		expect(count).toBe(2);
		a.reportChanged();
		expect(count).toBe(3);
		expect(isObserved(o)).toBe(false);
		expect(isObserved(o, g)).toBe(true);
	});

	it("can isolate actions to a new graph", () => {
		const g = graph();

		g.runAction(() => {
			expect(g.isInAction()).toBe(true);
		});

		g.runAction(() => {
			expect(isInAction()).toBe(false);
		});

		runInAction(() => {
			expect(g.isInAction()).toBe(false);
		});
	});

	it("can query the tracking state of the graph", () => {
		let count = 0;

		const c = computed(() => {
			count++;
			return isTracking();
		});

		expect(isTracking()).toBe(false);
		expect(c.get()).toBe(true);
		expect(count).toBe(1);
		autorun(() => {
			count++;
			expect(isTracking()).toBe(true);
			expect(c.get()).toBe(true);
		});
		expect(count).toBe(3);
		expect(isTracking()).toBe(false);
		autorun(() =>
			untracked(() => {
				count++;
				expect(isTracking()).toBe(false);
			})
		);
		expect(count).toBe(4);
	});
});
