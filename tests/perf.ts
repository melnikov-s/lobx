import * as lobx from "../lib/lobx";
import * as mobx from "mobx";

const performance = global["performance"];

mobx.configure({
	enforceActions: "never",
});

const SAMPLES = 30;

function runSamples(perfTest, resultsFn) {
	const results = [];
	for (let i = 0; i < SAMPLES; i++) {
		results.push(perfTest());
	}

	const finalResults = [];

	for (let i = 0; i < results.length; i++) {
		const result = results[i];

		for (let i = 0; i < result.length; i++) {
			finalResults[i] = (finalResults[i] || 0) + result[i];
		}
	}

	for (let i = 0; i < finalResults.length; i++) {
		finalResults[i] /= SAMPLES;
	}

	resultsFn(finalResults);
}

describe("lobx tests", () => {
	const { computed, observable, reaction, autorun, runInAction } = lobx;

	test("one observes ten thousand that observe one", function (done) {
		console.log("-------- lobx results --------");
		runSamples(
			() => {
				const a = observable.box(2);

				const observers = [];
				for (let i = 0; i < 10000; i++) {
					(function (idx) {
						observers.push(
							computed(function () {
								return a.get() * idx;
							})
						);
					})(i);
				}

				const b = computed(function () {
					let res = 0;
					for (let i = 0; i < observers.length; i++) res += observers[i].get();
					return res;
				});

				const start = performance.now();

				reaction(
					() => b.get(),
					() => {}
				);
				expect(b.get()).toBe(99990000);
				const initial = performance.now();

				a.set(3);
				expect(b.get()).toBe(149985000);
				const end = performance.now();

				return [initial - start, end - initial];
			},
			(results) => {
				console.log(
					"One observers many observes one - Started/Updated in " +
						results[0] +
						"/" +
						results[1] +
						" ms."
				);
			}
		);

		done();
	});

	test("five hundred properties that observe their sibling", function (done) {
		runSamples(
			() => {
				const a = observable.box(1);
				const observables: any[] = [a];
				for (let i = 0; i < 500; i++) {
					(function (idx) {
						observables.push(
							computed(function () {
								return observables[idx].get() + 1;
							})
						);
					})(i);
				}

				const start = performance.now();

				const last = observables[observables.length - 1];
				reaction(
					() => last.get(),
					() => {}
				);
				expect(last.get()).toBe(501);
				const initial = performance.now();

				a.set(2);
				expect(last.get()).toBe(502);
				const end = performance.now();
				return [initial - start, end - initial];
			},
			(results) => {
				console.log(
					"500 props observing sibling -  Started/Updated in " +
						results[0] +
						"/" +
						results[1] +
						" ms."
				);
			}
		);
		done();
	});

	test("late dependency change", function (done) {
		runSamples(
			() => {
				const values = [];
				for (let i = 0; i < 100; i++) values.push(observable.box(0));

				const sum = computed(function () {
					let sum = 0;
					for (let i = 0; i < 100; i++) sum += values[i].get();
					return sum;
				});

				reaction(
					() => sum.get(),
					() => {}
				);

				const start = performance.now();

				runInAction(() => {
					for (let i = 0; i < 10000; i++) values[99].set(i);
				});

				expect(sum.get()).toBe(9999);
				return [performance.now() - start];
			},
			(results) => {
				console.log(
					"Late dependency change - Updated in " + results[0] + "ms."
				);
			}
		);
		done();
	});

	test("lots of unused computables", function (done) {
		runSamples(
			() => {
				const a = observable.box(1);

				const observers = [];
				for (let i = 0; i < 10000; i++) {
					(function (idx) {
						observers.push(
							computed(function () {
								return a.get() * idx;
							})
						);
					})(i);
				}

				const b = computed(function () {
					let res = 0;
					for (let i = 0; i < observers.length; i++) res += observers[i].get();
					return res;
				});

				let sum = 0;
				const subscription = autorun(() => (sum = b.get()));

				expect(sum).toBe(49995000);

				subscription();

				const start = performance.now();

				a.set(3);
				expect(sum).toEqual(49995000);

				const end = performance.now();
				return [end - start];
			},
			(results) => {
				console.log("Unused computables -   Updated in " + results[0] + " ms.");
			}
		);

		done();
	});

	test("many unreferenced observables", function (done) {
		runSamples(
			() => {
				const a = observable.box(3);
				const b = observable.box(6);
				const c = observable.box(7);
				const d = computed(function () {
					return a.get() * b.get() * c.get();
				});
				expect(d.get()).toBe(126);

				const start = performance.now();
				runInAction(() => {
					for (let i = 0; i < 10000; i++) {
						c.set(i);
						d.get();
					}
				});

				const end = performance.now();

				return [end - start];
			},
			(results) => {
				console.log("Unused observables -  Updated in " + results[0] + " ms.");
			}
		);

		done();
	});

	test("computed memoization", function (done) {
		runSamples(
			() => {
				const computeds = [];
				for (let i = 0; i < 40; i++) {
					computeds.push(
						computed(() =>
							i ? computeds[i - 1].get() + computeds[i - 1].get() : 1
						)
					);
				}
				const start = performance.now();
				expect(computeds[27].get()).toBe(134217728);
				return [performance.now() - start];
			},
			(results) => {
				console.log("computed memoization " + results[0] + " ms.");
			}
		);

		done();
	});

	test("object observation (empty)", function (done) {
		runSamples(
			() => {
				const start = performance.now();
				for (let i = 0; i < 1000; i++) {
					const obj = {};
					observable(obj);
				}
				return [performance.now() - start];
			},
			(results) => {
				console.log("object observation (empty) " + results[0] + " ms.");
			}
		);

		done();
	});

	test("array observation (empty)", function (done) {
		runSamples(
			() => {
				const start = performance.now();
				for (let i = 0; i < 1000; i++) {
					const arr = [];
					observable(arr);
				}
				return [performance.now() - start];
			},
			(results) => {
				console.log("array observation (empty) " + results[0] + " ms.");
			}
		);

		done();
	});

	test("object observation", function (done) {
		runSamples(
			() => {
				const start = performance.now();
				for (let i = 0; i < 1000; i++) {
					const obj = {
						a: "a",
						b: { b: { c: { d: "e" } } },
						c: "c",
						d: "d",
						e: { b: { c: { d: "e" } } },
					};
					observable(obj);
				}
				return [performance.now() - start];
			},
			(results) => {
				console.log("object observation " + results[0] + " ms.");
			}
		);

		done();
	});

	test("array observation", function (done) {
		runSamples(
			() => {
				const start = performance.now();
				for (let i = 0; i < 1000; i++) {
					const arr = [
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
					];
					observable(arr);
				}
				return [performance.now() - start];
			},
			(results) => {
				console.log("array observation " + results[0] + " ms.");
			}
		);

		done();
	});
});

describe("mobx tests", () => {
	const { computed, observable, reaction, autorun, runInAction } = mobx;

	test("one observes ten thousand that observe one", function (done) {
		console.log("-------- mobx results --------");
		runSamples(
			() => {
				const a = observable.box(2);

				const observers = [];
				for (let i = 0; i < 10000; i++) {
					(function (idx) {
						observers.push(
							computed(function () {
								return a.get() * idx;
							})
						);
					})(i);
				}

				const b = computed(function () {
					let res = 0;
					for (let i = 0; i < observers.length; i++) res += observers[i].get();
					return res;
				});

				const start = performance.now();

				reaction(
					() => b.get(),
					() => {}
				);
				expect(b.get()).toBe(99990000);
				const initial = performance.now();

				runInAction(() => a.set(3));
				expect(b.get()).toBe(149985000);
				const end = performance.now();

				return [initial - start, end - initial];
			},
			(results) => {
				console.log(
					"One observers many observes one - Started/Updated in " +
						results[0] +
						"/" +
						results[1] +
						" ms."
				);
			}
		);

		done();
	});

	test("five hundred properties that observe their sibling", function (done) {
		runSamples(
			() => {
				const a = observable.box(1);
				const observables: any = [a];
				for (let i = 0; i < 500; i++) {
					(function (idx) {
						observables.push(
							computed(function () {
								return observables[idx].get() + 1;
							})
						);
					})(i);
				}

				const start = performance.now();

				const last = observables[observables.length - 1];
				reaction(
					() => last.get(),
					() => {}
				);
				expect(last.get()).toBe(501);
				const initial = performance.now();

				a.set(2);
				expect(last.get()).toBe(502);
				const end = performance.now();
				return [initial - start, end - initial];
			},
			(results) => {
				console.log(
					"500 props observing sibling -  Started/Updated in " +
						results[0] +
						"/" +
						results[1] +
						" ms."
				);
			}
		);
		done();
	});

	test("late dependency change", function (done) {
		runSamples(
			() => {
				const values = [];
				for (let i = 0; i < 100; i++) values.push(observable.box(0));

				const sum = computed(function () {
					let sum = 0;
					for (let i = 0; i < 100; i++) sum += values[i].get();
					return sum;
				});

				reaction(
					() => sum.get(),
					() => {}
				);

				const start = performance.now();

				runInAction(() => {
					for (let i = 0; i < 10000; i++) values[99].set(i);
				});

				expect(sum.get()).toBe(9999);
				return [performance.now() - start];
			},
			(results) => {
				console.log(
					"Late dependency change - Updated in " + results[0] + "ms."
				);
			}
		);
		done();
	});

	test("lots of unused computables", function (done) {
		runSamples(
			() => {
				const a = observable.box(1);

				const observers = [];
				for (let i = 0; i < 10000; i++) {
					(function (idx) {
						observers.push(
							computed(function () {
								return a.get() * idx;
							})
						);
					})(i);
				}

				const b = computed(function () {
					let res = 0;
					for (let i = 0; i < observers.length; i++) res += observers[i].get();
					return res;
				});

				let sum = 0;
				const subscription = autorun(() => (sum = b.get()));

				expect(sum).toBe(49995000);

				subscription();

				const start = performance.now();

				a.set(3);
				expect(sum).toEqual(49995000);

				const end = performance.now();
				return [end - start];
			},
			(results) => {
				console.log("Unused computables -   Updated in " + results[0] + " ms.");
			}
		);

		done();
	});

	test("many unreferenced observables", function (done) {
		runSamples(
			() => {
				const a = observable.box(3);
				const b = observable.box(6);
				const c = observable.box(7);
				const d = computed(function () {
					return a.get() * b.get() * c.get();
				});
				expect(d.get()).toBe(126);

				const start = performance.now();
				runInAction(() => {
					for (let i = 0; i < 10000; i++) {
						c.set(i);
						d.get();
					}
				});

				const end = performance.now();

				return [end - start];
			},
			(results) => {
				console.log("Unused observables -  Updated in " + results[0] + " ms.");
			}
		);

		done();
	});

	test("computed memoization", function (done) {
		runSamples(
			() => {
				const computeds = [];
				for (let i = 0; i < 40; i++) {
					computeds.push(
						computed(() =>
							i ? computeds[i - 1].get() + computeds[i - 1].get() : 1
						)
					);
				}
				const start = performance.now();
				expect(computeds[27].get()).toBe(134217728);
				return [performance.now() - start];
			},
			(results) => {
				console.log("computed memoization " + results[0] + " ms.");
			}
		);

		done();
	});

	test("object observation (empty)", function (done) {
		runSamples(
			() => {
				const start = performance.now();
				for (let i = 0; i < 1000; i++) {
					const obj = {};
					observable(obj);
				}
				return [performance.now() - start];
			},
			(results) => {
				console.log("object observation (empty) " + results[0] + " ms.");
			}
		);

		done();
	});

	test("array observation (empty)", function (done) {
		runSamples(
			() => {
				const start = performance.now();
				for (let i = 0; i < 1000; i++) {
					const arr = [];
					observable(arr);
				}
				return [performance.now() - start];
			},
			(results) => {
				console.log("array observation (empty) " + results[0] + " ms.");
			}
		);

		done();
	});

	test("object observation", function (done) {
		runSamples(
			() => {
				const start = performance.now();
				for (let i = 0; i < 1000; i++) {
					const obj = {
						a: "a",
						b: { b: { c: { d: "e" } } },
						c: "c",
						d: "d",
						e: { b: { c: { d: "e" } } },
					};
					observable(obj);
				}
				return [performance.now() - start];
			},
			(results) => {
				console.log("object observation " + results[0] + " ms.");
			}
		);

		done();
	});

	test("array observation", function (done) {
		runSamples(
			() => {
				const start = performance.now();
				for (let i = 0; i < 1000; i++) {
					const arr = [
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
						{ b: { c: { d: "e" } } },
					];
					observable(arr);
				}
				return [performance.now() - start];
			},
			(results) => {
				console.log("array observation " + results[0] + " ms.");
			}
		);

		done();
	});
});
