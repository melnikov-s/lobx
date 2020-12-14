import {
	autorun,
	observable,
	computed,
	enforceActions,
	task,
	action
} from "../src/index";

test("properties can be configured with a decorator", () => {
	class CS {
		@observable value = 1;
		count = 0;

		@computed get comp() {
			this.count++;
			return this.value * 2;
		}
	}

	const C = observable(CS);

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

		class CS {
			@observable value = 1;

			@action inc() {
				this.value++;
			}
		}

		const C = observable(CS);
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

		class CS {
			@observable value = 1;

			@action async inc() {
				this.value++;
				await task(Promise.resolve());
				this.value++;
			}
		}

		const C = observable(CS);
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
	class CS {
		@computed get comp() {
			return {};
		}

		@computed.withOptions({ keepAlive: true }) get compAlive() {
			return {};
		}
	}

	const C = observable(CS);

	const o = new C();
	const keepAlive = o.compAlive;
	const notKeepAlive = o.comp;
	expect(keepAlive).toBe(o.compAlive);
	expect(notKeepAlive).not.toBe(o.comp);
});

test("observable decorators can be further configured with options", () => {
	class CS {
		@observable.withOptions({ ref: true }) value = { num: 0 };

		@computed get comp() {
			return this.value.num;
		}
	}

	const C = observable(CS);

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
