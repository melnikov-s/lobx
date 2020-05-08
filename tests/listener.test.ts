import { observable, listener, runInAction } from "../src";

describe("listener tests", () => {
	it("reacts to whatever is tracked", () => {
		let count = 0;
		const l = listener(() => count++);
		const o = observable.box(0);
		expect(count).toBe(0);
		l.track(() => o.get());
		o.set(1);
		expect(count).toBe(1);
	});

	it("continues to track once the callback is called", () => {
		let count = 0;
		const l = listener(() => count++);
		const o = observable.box(0);
		l.track(() => o.get());
		o.set(1);
		o.set(2);
		o.set(3);
		expect(count).toBe(3);
	});

	it("additional track invocations unsubscribes from previous ones", () => {
		let count = 0;
		const l = listener(() => count++);
		const o = observable.box(0);
		l.track(() => o.get());
		l.track(() => {});
		o.set(1);
		o.set(2);
		o.set(3);
		expect(count).toBe(0);
	});

	it("calling dispose will no longer invoke the callback", () => {
		let count = 0;
		const l = listener(() => count++);
		const o = observable.box(0);
		l.track(() => o.get());
		o.set(1);
		l.dispose();
		o.set(2);
		o.set(3);
		expect(count).toBe(1);
	});

	it("can perform an action during the callback", () => {
		const l = listener(() => runInAction(() => o2.set(o.get())));
		const o = observable.box(0);
		const o2 = observable.box(0);
		l.track(() => o.get());
		o.set(1);
		expect(o2.get()).toBe(1);
		l.dispose();
		o.set(2);
		o.set(3);
		expect(o2.get()).toBe(1);
	});
});
