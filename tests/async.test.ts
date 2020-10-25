import {
	observable,
	task,
	reaction,
	runInTask,
	getDefaultGraph,
	enforceActions
} from "../src";

function delay<T>(time: number, value: T) {
	return new Promise<T>(resolve => {
		setTimeout(() => {
			resolve(value);
		}, time);
	});
}

function delayThrow<T>(time: number, value: T) {
	return new Promise<T>((_, reject) => {
		setTimeout(() => {
			reject(value);
		}, time);
	});
}

function delayFn(time: number, fn: () => void) {
	return new Promise(resolve => {
		setTimeout(() => {
			fn();
			resolve();
		}, time);
	});
}

const expectNoActionsRunning = () =>
	expect(getDefaultGraph().isInAction()).toBe(false);

const actionAsync = <T>(fn: (...args: any[]) => T) => (...args: any[]) =>
	(runInTask(() => fn(...args)) as unknown) as T;

beforeEach(() => {
	enforceActions(true);
});

/*
async implementation inspired by actionAsync in mobx-utils
tests copied from: https://github.com/mobxjs/mobx-utils/blob/v5.6.1/test/action-async.ts
*/

test("[mobx-test] it should support async actions", async () => {
	const values = [1];
	const x = observable({ a: 1 });
	reaction(
		() => x.a,
		v => values.push(v)
	);

	const f = async function(initial) {
		x.a = initial; // this runs in action
		x.a = await task(delay(100, 3));
		await task(delay(100, 0));
		x.a = 4;
		x.a = await task(5 as any);
		expect(x.a).toBe(5);
		return x.a;
	};

	const v = await runInTask(() => f(2));
	expect(v).toBe(5);
	expect(values).toEqual([1, 2, 3, 4, 5]);
	expectNoActionsRunning();
});

test("[mobx-test] it should support try catch in async", async () => {
	const values = [1];
	const x = observable({ a: 1 });
	reaction(
		() => x.a,
		v => values.push(v)
	);

	const f = async function(initial) {
		x.a = initial; // this runs in action
		try {
			x.a = await task(delayThrow(100, 5));
			await task(delay(100, 0));
			x.a = 4;
		} catch (e) {
			x.a = e;
		}
		return x.a;
	};

	const v = await runInTask(() => f(2));
	expect(v).toBe(5);
	expect(values).toEqual([1, 2, 5]);
	expectNoActionsRunning();
});

test("[mobx-test] it should support throw from async actions", async () => {
	try {
		await runInTask(async () => {
			await task(delay(10, 7));
			throw 7;
		});
		throw new Error("should fail");
	} catch (e) {
		expect(e).toBe(7);
	}
	expectNoActionsRunning();
});

test("[mobx-test] it should support throw from awaited promise", async () => {
	try {
		await runInTask(async () => {
			return await task(delayThrow(10, 7));
		});
		throw new Error("should fail");
	} catch (e) {
		expect(e).toBe(7);
	}
	expectNoActionsRunning();
});

test("[mobx-test] it should support async actions within async actions", async () => {
	const values = [1];
	const x = observable({ a: 1 });
	reaction(
		() => x.a,
		v => values.push(v)
	);

	const innerF = actionAsync(async initial => {
		x.a = initial; // this runs in action
		x.a = await task(delay(100, 3));
		await task(delay(100, 0));
		x.a = 4;
		return x.a;
	});

	const f1 = actionAsync(async initial => {
		x.a = await task(innerF(initial));
		x.a = await task(delay(100, 5));
		await task(delay(100, 0));
		x.a = 6;
		return x.a;
	});

	const v = await f1(2);
	expect(v).toBe(6);
	expect(values).toEqual([1, 2, 3, 4, 5, 6]);
	expectNoActionsRunning();
});

test("[mobx-test] it should support async actions within async actions that are awaited later", async () => {
	const values = [1];
	const x = observable({ a: 1 });
	reaction(
		() => x.a,
		v => values.push(v)
	);

	const innerF = actionAsync(async initial => {
		x.a = initial; // this runs in action
		x.a = await task(delay(10, 3));
		await task(delay(30, 0));
		x.a = 6;
		return 7;
	});

	const f1 = actionAsync(async initial => {
		const futureInnerF = innerF(initial);
		x.a = await task(delay(20, 4));
		await task(delay(10, 0));
		x.a = 5;
		x.a = await task(futureInnerF);
		return x.a;
	});

	const v = await f1(2);
	expect(v).toBe(7);
	expect(values).toEqual([1, 2, 3, 4, 5, 6, 7]);
	expectNoActionsRunning();
});

test("[mobx-test] it should support async actions within async actions that throw", async () => {
	const values = [1];
	const x = observable({ a: 1 });
	reaction(
		() => x.a,
		v => values.push(v)
	);

	const innerF = actionAsync(async function(initial) {
		x.a = initial; // this runs in action
		x.a = await task(delay(100, 3));
		await task(delay(100, 0));
		x.a = 4;
		throw "err";
	});

	const f = actionAsync(async function(initial) {
		x.a = await task(innerF(initial));
		x.a = await task(delay(100, 5));
		await task(delay(100, 0));
		x.a = 6;
		return x.a;
	});

	try {
		await f(2);
		fail("should fail");
	} catch (e) {
		expect(e).toBe("err");
	}

	expectNoActionsRunning();
});

test("[mobx-test] dangling promises created directly inside the action without using task should be ok", async () => {
	const values = [1];
	const x = observable({ a: 1 });
	reaction(
		() => x.a,
		v => values.push(v)
	);

	let danglingP;

	const f1 = actionAsync(async () => {
		danglingP = delay(100, 1); // dangling promise
		x.a = 2;
		x.a = await task(delay(100, 3));
	});

	await f1();

	expectNoActionsRunning();
	expect(values).toEqual([1, 2, 3]);

	expect(danglingP).toBeTruthy();
	await danglingP;
	expectNoActionsRunning();
});

test("[mobx-test] it should support recursive async", async () => {
	const values = [10];
	const x = observable({ a: 10 });
	reaction(
		() => x.a,
		v => values.push(v)
	);

	const f1 = actionAsync(async () => {
		if (x.a <= 0) return;
		x.a -= await task(delay(10, 1));
		await task(f1());
	});

	await f1();
	expect(values).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
	expectNoActionsRunning();
});

test("[mobx-test] it should support parallel async", async () => {
	const values = [1];
	const x = observable({ a: 1 });
	reaction(
		() => x.a,
		v => values.push(v)
	);

	const f1 = actionAsync(async () => {
		x.a = 2;
		x.a = await task(delay(20, 6));
		x.a = await task(delay(40, 9));
	});

	const f2 = actionAsync(async () => {
		x.a = 3;
		x.a = await task(delay(10, 5));
		x.a = await task(delay(30, 8));
	});

	const f3 = actionAsync(async () => {
		x.a = 4; // 5
		x.a = await task(delay(20, 7)); // 25
		x.a = await task(delay(40, 10)); // 45
	});

	await Promise.all([
		f1(),
		f2(),
		(async () => {
			await delay(5, 0);
			await f3();
		})(),
		(async () => {
			expectNoActionsRunning();
		})(),
		delayFn(4, expectNoActionsRunning),
		delayFn(6, expectNoActionsRunning),
		delayFn(15, expectNoActionsRunning),
		delayFn(24, expectNoActionsRunning),
		delayFn(26, expectNoActionsRunning),
		delayFn(35, expectNoActionsRunning),
		delayFn(44, expectNoActionsRunning),
		delayFn(46, expectNoActionsRunning)
	]);
	expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	expectNoActionsRunning();
});

test("[mobx-test] calling async actions that do not await should be ok", async () => {
	const values = [1];
	const x = observable({ a: 1 });
	reaction(
		() => x.a,
		v => values.push(v)
	);

	const f1 = actionAsync(async () => {
		x.a++;
	});
	const f2 = actionAsync(async () => {
		x.a++;
	});

	await f1();
	expectNoActionsRunning();
	await f2();
	expectNoActionsRunning();

	await Promise.all([f1(), f2()]);
	expectNoActionsRunning();

	expect(values).toEqual([1, 2, 3, 5]);
});

test("[mobx-test] complex case", async () => {
	const values = [1];
	const x = observable({ a: 1 });
	reaction(
		() => x.a,
		v => values.push(v)
	);

	const f1 = actionAsync(async (fn: any) => {
		x.a++;
		await task(fn());
	});

	const f2 = async () => {
		await f3();
	};

	const f3 = async () => {
		await delay(10, 1);
		await f4();
	};

	const f4 = async () => {
		await f5();
	};

	const f5 = actionAsync(async () => {
		x.a += await task(delay(10, 1));
	});

	await f1(async () => {
		await f2();
	});
	expectNoActionsRunning();
	expect(values).toEqual([1, 2, 3]);
});

test("[mobx-test] immediately resolved promises", async () => {
	const values = [1];
	const x = observable({ a: 1 });
	reaction(
		() => x.a,
		v => values.push(v)
	);

	const f1 = actionAsync(async () => {
		await task(Promise.resolve(""));
		x.a = await task(Promise.resolve(3));
	});

	const f2 = actionAsync(async () => {
		const f1Promise = f1();
		x.a = 2;
		x.a = await task(Promise.resolve(3));
		await task(f1Promise);
	});

	await f2();
	expect(values).toEqual([1, 2, 3]);
	expectNoActionsRunning();
});

test("[mobx-test] reusing promises", async () => {
	const values = [1];
	const x = observable({ a: 1 });
	reaction(
		() => x.a,
		v => values.push(v)
	);

	const p = delay(10, 2);

	const f1 = actionAsync(async () => {
		const result = await task(p);
		x.a = result;
	});

	const f2 = actionAsync(async () => {
		const result = (await task(p)) + 1;
		x.a = result;
	});

	await Promise.all([f1(), f2()]);
	expect(values).toEqual([1, 3]);
	expectNoActionsRunning();
});

test("[mobx-test] actions that throw in parallel", async () => {
	const r = shouldThrow =>
		new Promise((resolve, reject) => {
			setTimeout(() => {
				if (shouldThrow) {
					reject("Error");
					return;
				}
				resolve(42);
			}, 10);
		});

	const actionAsync1 = actionAsync(async () => {
		try {
			return await task(r(true));
		} catch (err) {
			return "error";
		}
	});

	const actionAsync2 = actionAsync(async () => {
		try {
			return await task(r(false));
		} catch (err) {
			return "error";
		}
	});

	const result = await Promise.all([
		actionAsync1(),
		actionAsync2(),
		actionAsync1()
	]);

	expectNoActionsRunning();
	expect(result).toMatchInlineSnapshot(`
        Array [
          "error",
          42,
          "error",
        ]
    `);
});
