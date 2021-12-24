import {
	autorun,
	observable,
	computed,
	enforceActions,
	task,
	action,
	isInAction,
	isObservable,
	Observable,
} from "../src/index";

test("properties can be configured with a decorator", () => {
	class C extends Observable {
		@observable value = 1;
		count = 0;

		@computed get comp() {
			this.count++;
			return this.value * 2;
		}
	}

	let count = 0;
	const o = new C();

	autorun(() => {
		o.comp;
		count++;
	});

	expect(o.count).toBe(1);

	o.value = 2;
	expect(o.count).toBe(2);
	expect(count).toBe(2);

	expect(o.comp).toBe(4);
	expect(o.count).toBe(2);
});

test("actions can be configured with a decorator", () => {
	try {
		enforceActions(true);

		class C extends Observable {
			@observable value = 1;

			@action inc() {
				this.value++;
			}
		}

		const c = new C();
		expect(() => c.inc()).not.toThrowError();

		expect(c.value).toBe(2);
	} finally {
		enforceActions(false);
	}
});

test("async actions can be configured with a decorator", async () => {
	try {
		enforceActions(true);

		class C extends Observable {
			@observable value = 1;

			@action async inc() {
				this.value++;
				await task(Promise.resolve());
				this.value++;
			}
		}

		const c = new C();
		let p: Promise<void>;
		expect(() => (p = c.inc())).not.toThrowError();
		expect(c.value).toBe(2);
		await p;
		expect(c.value).toBe(3);
	} finally {
		enforceActions(false);
	}
});

test("computed decorators can be further configured with options", () => {
	class C extends Observable {
		@computed get comp() {
			return {};
		}

		@computed.opts({ keepAlive: true }) get compAlive() {
			return {};
		}
	}

	const o = new C();
	const keepAlive = o.compAlive;
	const notKeepAlive = o.comp;
	expect(keepAlive).toBe(o.compAlive);
	expect(notKeepAlive).not.toBe(o.comp);
});

test("observable decorators can be further configured with options", () => {
	class C extends Observable {
		@observable.opts({ ref: true }) value = { num: 0 };

		@computed get comp() {
			return this.value.num;
		}
	}

	const o = new C();
	let count = 0;

	autorun(() => {
		o.comp;
		count++;
	});

	expect(count).toBe(1);
	expect(o.comp).toBe(0);
	o.value.num = 1;
	expect(count).toBe(1);
	expect(o.comp).toBe(0);
	o.value = { num: 2 };
	expect(count).toBe(2);
	expect(o.comp).toBe(2);
});

test("decorators work with inheritance", () => {
	class Base extends Observable {
		@observable baseProp = {};
		nonObserved = {};
		@action baseAction() {
			return isInAction();
		}
	}

	class C extends Base {
		@observable prop = {};
		@action action() {
			return isInAction();
		}
	}

	const c = new C();
	expect(isObservable(c.baseProp)).toBe(true);
	expect(isObservable(c.nonObserved)).toBe(false);
	expect(c.baseAction()).toBe(true);
	expect(c.action()).toBe(true);
});
