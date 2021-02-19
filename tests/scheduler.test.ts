import { observable, createScheduler, Scheduler, isInBatch } from "../src";

const createTimeoutScheduler = (timeout: number = 0): Scheduler =>
	createScheduler((fn) => setTimeout(fn, timeout));

beforeEach(() => {
	jest.useFakeTimers();
});

test("can create an autorun scheduler", () => {
	const o = observable.box(0);
	const scheduler = createTimeoutScheduler(0);
	let count = 0;
	scheduler.autorun(() => {
		o.get();
		count++;
	});
	expect(count).toBe(1);
	o.set(1);
	o.set(2);
	expect(count).toBe(1);
	jest.runAllTimers();
	expect(count).toBe(2);
});

test("can create a reaction scheduler", () => {
	const o = observable.box(0);
	const scheduler = createTimeoutScheduler(0);
	let count = 0;
	scheduler.reaction(
		() => o.get(),
		() => count++
	);
	o.set(1);
	o.set(2);
	expect(count).toBe(0);
	jest.runAllTimers();
	expect(count).toBe(1);
	o.set(3);
});

test("reaction scheduler passes in the last value into callback", () => {
	const o = observable.box(0);
	const scheduler = createTimeoutScheduler(0);
	const count = 0;
	let value = 0;
	scheduler.reaction(
		() => o.get(),
		(v) => {
			value = v;
		}
	);
	o.set(1);
	o.set(2);
	o.set(3);
	expect(value).toBe(0);
	jest.runAllTimers();
	expect(value).toBe(3);
});

test("unsbuscribe removes scheduled callback", () => {
	const o = observable.box(0);
	const scheduler = createTimeoutScheduler(0);
	let count = 0;
	const unsub = scheduler.autorun(() => {
		o.get();
		count++;
	});
	expect(count).toBe(1);
	o.set(1);
	unsub();
	jest.runAllTimers();
	expect(count).toBe(1);
});

test("can create a scheduled listener", () => {
	let count = 0;
	const scheduler = createTimeoutScheduler(0);
	const l = scheduler.listener(() => count++);
	const o = observable.box(0);
	l.track(() => o.get());
	o.set(1);
	o.set(2);
	o.set(3);
	expect(count).toBe(0);
	jest.runAllTimers();
	expect(count).toBe(1);
});

test("scheduled reactions occur in a batch", () => {
	let count = 0;
	const scheduler = createTimeoutScheduler(0);
	const l = scheduler.listener(() => {
		count++;
		expect(isInBatch()).toBe(true);
	});
	const o = observable.box(0);
	l.track(() => o.get());
	o.set(1);
	o.set(2);
	o.set(3);
	expect(count).toBe(0);
	jest.runAllTimers();
	expect(count).toBe(1);
	expect(isInBatch()).toBe(false);
});

test("listeners on the same scheduler trigger in a tight loop", () => {
	let count = 0;
	let asserted = true;
	const createCustomScheduler = (timeout: number = 0): Scheduler =>
		createScheduler((fn) =>
			setTimeout(() => {
				expect(count).toBe(0);
				fn();
				expect(count).toBe(3);
				asserted = true;
			}, 0)
		);

	const scheduler = createCustomScheduler();
	const o = observable.box(0);
	const l = scheduler.listener(() => {
		count++;
	});
	const l2 = scheduler.listener(() => {
		count++;
	});
	const l3 = scheduler.listener(() => {
		count++;
	});
	l.track(() => o.get());
	l2.track(() => o.get());
	l3.track(() => o.get());
	o.set(1);
	o.set(2);
	jest.runAllTimers();
	expect(count).toBe(3);
	expect(asserted).toBe(true);
});

test("can create a sync scheduler", () => {
	let count = 0;
	const createCustomScheduler = (): Scheduler => createScheduler((fn) => fn());

	const scheduler = createCustomScheduler();
	const o = observable.box(0);
	const l = scheduler.listener(() => {
		count++;
	});
	const l2 = scheduler.listener(() => {
		count++;
	});
	const l3 = scheduler.listener(() => {
		count++;
	});
	l.track(() => o.get());
	l2.track(() => o.get());
	l3.track(() => o.get());
	o.set(1);
	o.set(2);
	expect(count).toBe(6);
});
