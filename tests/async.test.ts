import {
	observable,
	asyncTransaction,
	asyncAction,
	autorun,
	type
} from "../src";

function doAsync<T>(resolveWith: T, success = true) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			success ? resolve(resolveWith) : reject(resolveWith);
		}, 0);
	}) as Promise<T>;
}

[asyncTransaction, asyncAction].forEach(asyncMethod => {
	const name = asyncMethod === asyncTransaction ? "transaction" : "action";

	test(`then runs in ${name}`, async () => {
		const o = observable({ propA: 0, propB: 0 });
		let count = 0;
		autorun(() => {
			o.propA;
			o.propB;
			count++;
		});

		await asyncMethod(doAsync(1))
			.then(r => {
				o.propA = r;
				o.propB = r;
				return doAsync(2);
			})
			.then(r => {
				o.propA = r;
				o.propB = r;
			});

		expect(o.propA).toBe(2);
		expect(o.propB).toBe(2);
		expect(count).toBe(3);
	});

	test(`then runs in ${name} (await)`, async () => {
		const o = observable({ propA: 0, propB: 0 });
		let count = 0;
		autorun(() => {
			o.propA;
			o.propB;
			count++;
		});

		const r = await asyncMethod(doAsync(1));

		o.propA = r;
		o.propB = r;

		const rr = await asyncMethod(doAsync(2));

		o.propA = rr;
		o.propB = rr;

		expect(o.propA).toBe(2);
		expect(o.propB).toBe(2);
		await Promise.resolve();

		expect(count).toBe(3);
	});

	test(`catch runs in ${name}`, async () => {
		const o = observable({ propA: 0, propB: 0 });
		let count = 0;

		autorun(() => {
			o.propA;
			o.propB;
			count++;
		});

		await asyncMethod(doAsync(1, false))
			.catch(r => {
				o.propA = r;
				o.propB = r;
				return doAsync(2, false);
			})
			.catch(r => {
				o.propA = r;
				o.propB = r;
			});

		expect(o.propA).toBe(2);
		expect(o.propB).toBe(2);
		expect(count).toBe(3);
	});

	test(`catch runs in ${name} (await)`, async () => {
		const o = observable({ propA: 0, propB: 0 });
		let count = 0;
		autorun(() => {
			o.propA;
			o.propB;
			count++;
		});

		try {
			await asyncMethod(doAsync(1, false));
		} catch (r) {
			o.propA = r;
			o.propB = r;
			try {
				await asyncMethod(doAsync(2, false));
			} catch (rr) {
				o.propA = rr;
				o.propB = rr;
			}
		}

		expect(o.propA).toBe(2);
		expect(o.propB).toBe(2);
		await Promise.resolve();

		expect(count).toBe(3);
	});

	test(`finally runs in ${name}`, async () => {
		const o = observable({ propA: 0, propB: 0 });
		let count = 0;

		autorun(() => {
			o.propA;
			o.propB;
			count++;
		});

		await asyncMethod(doAsync(1))
			.finally(() => {
				o.propA++;
				o.propB++;
				return doAsync(2);
			})
			.finally(() => {
				o.propA++;
				o.propB++;
			});

		expect(o.propA).toBe(2);
		expect(o.propB).toBe(2);
		expect(count).toBe(3);
	});

	test(`finally runs in ${name} (await)`, async () => {
		const o = observable({ propA: 0, propB: 0 });
		let count = 0;
		autorun(() => {
			o.propA;
			o.propB;
			count++;
		});

		try {
			await asyncMethod(doAsync(1));
		} finally {
			o.propA++;
			o.propB++;
			try {
				await asyncMethod(doAsync(2));
			} finally {
				o.propA++;
				o.propB++;
			}
		}

		expect(o.propA).toBe(2);
		expect(o.propB).toBe(2);
		await Promise.resolve();

		expect(count).toBe(3);
	});
});

test("instanceof works as expected", async () => {
	const OldPromise = Promise;
	const p = new Promise(() => {});
	let ran = false;

	const o = observable.configure(
		{
			test: type.action({ async: true })
		},
		{
			async test() {
				expect(OldPromise).not.toBe(Promise); // we patched it
				expect(p).toBeInstanceOf(Promise); // but this still works
				ran = true;
			}
		}
	);

	expect(Promise).toBe(OldPromise);
	await o.test();
	await OldPromise.resolve();
	expect(ran).toBe(true);
	expect(Promise).toBe(OldPromise); // it's been restored
});

test("calling nested async actions", async () => {
	let ran = false;
	const OldPromise = Promise;
	let PatchedPromise: any;

	const o = observable.configure(
		{
			testOutter: type.action({ async: true }),
			testInner: type.action({ async: true })
		},
		{
			async testOutter() {
				PatchedPromise = Promise;
				expect(OldPromise).not.toBe(Promise); // we patched it
				await this.testInner();
				expect(OldPromise).not.toBe(Promise); // still patched
				ran = true;
			},

			async testInner() {
				expect(OldPromise).not.toBe(Promise); // we patched it
				expect(PatchedPromise).toBe(Promise); // same promise as before, no double proxying
			}
		}
	);

	await o.testOutter();
	expect(ran).toBe(true);
	await OldPromise.resolve();
	expect(Promise).toBe(OldPromise); // it's been restored
});
