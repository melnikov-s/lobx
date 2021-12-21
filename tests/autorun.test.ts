import { observable, autorun } from "../src";

test("runs the callback initially", () => {
	let count = 0;
	autorun(() => count++);
	expect(count).toBe(1);
});

test("can be disposed on first run", function () {
	const o = observable.box(1);
	const values = [];

	autorun((r) => {
		r.dispose();
		values.push(o.get());
	});

	o.set(2);

	expect(values).toEqual([1]);
});

test("runs the callback every time an observer is changed", () => {
	let count = 0;
	const o = observable.box(0);
	autorun(() => {
		count++;
		o.get();
	});
	expect(count).toBe(1);
	o.set(1);
	expect(count).toBe(2);
});

test("does not run the callback when unsubscribed", () => {
	let count = 0;
	const o = observable.box(0);
	const u = autorun(() => {
		o.get();
		count++;
	});
	expect(count).toBe(1);
	o.set(1);
	expect(count).toBe(2);
	u();
	o.set(2);
	expect(count).toBe(2);
});

test("[mobx-test] autoruns created in autoruns should kick off", () => {
	const x = observable.box(3);
	const x2 = [];
	let d;

	autorun(function () {
		if (d) {
			// dispose previous autorun
			d();
		}
		d = autorun(function () {
			x2.push(x.get() * 2);
		});
	});

	x.set(4);
	expect(x2).toEqual([6, 8]);
});
