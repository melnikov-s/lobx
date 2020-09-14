import {
	observable,
	transactionTask,
	isInAction,
	isInTransactionAction,
	task,
	autorun
} from "../src";

function doAsync<T>(resolveWith: T, success = true) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			success ? resolve(resolveWith) : reject(resolveWith);
		}, 0);
	}) as Promise<T>;
}

[transactionTask, task].forEach(asyncMethod => {
	const name = asyncMethod === transactionTask ? "transaction" : "action";
	const checker =
		asyncMethod === transactionTask ? isInTransactionAction : isInAction;

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
				expect(checker()).toBe(true);
				o.propA = r;
				o.propB = r;
				return doAsync(2);
			})
			.then(r => {
				expect(checker()).toBe(true);
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

		expect(checker()).toBe(true);
		o.propA = r;
		o.propB = r;

		const rr = await asyncMethod(doAsync(2));

		expect(checker()).toBe(true);
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
				expect(checker()).toBe(true);
				o.propA = r;
				o.propB = r;
				return doAsync(2, false);
			})
			.catch(r => {
				expect(checker()).toBe(true);
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
			expect(checker()).toBe(true);
			o.propA = r;
			o.propB = r;
			try {
				await asyncMethod(doAsync(2, false));
			} catch (rr) {
				expect(checker()).toBe(true);
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
				expect(checker()).toBe(true);
				o.propA++;
				o.propB++;
				return doAsync(2);
			})
			.finally(() => {
				expect(checker()).toBe(true);
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
			expect(checker()).toBe(true);
			o.propA++;
			o.propB++;
			try {
				await asyncMethod(doAsync(2));
			} finally {
				expect(checker()).toBe(true);
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
