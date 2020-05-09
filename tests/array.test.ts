import {
	computed,
	autorun,
	reaction,
	observable,
	trace,
	isObservable,
	getObservableSource
} from "../src";

const array = (obj: any[] = []): any[] => {
	return observable(obj);
};

test("array crud", function() {
	const ar = array([1, 4]);
	const buf = [];
	const disposer = trace(ar, function(changes) {
		buf.push(changes);
	});

	ar[1] = 3; // 1,3
	ar[2] = 0; // 1, 3, 0
	ar.shift(); // 3, 0
	ar.push(1, 2); // 3, 0, 1, 2
	ar.splice(1, 2, 3, 4); // 3, 3, 4, 2
	expect(ar.slice()).toEqual([3, 3, 4, 2]);
	ar.splice(6);
	ar.splice(6, 2);
	ar.splice(0, ar.length, "a");
	ar.pop();
	ar.pop(); // does not fire anything

	// check the object param
	buf.forEach(function(change) {
		expect(change.object).toBe(ar);
		delete change.object;
	});

	const result = [
		{ type: "updateArray", index: 1, oldValue: 4, newValue: 3 },
		{
			type: "spliceArray",
			index: 2,
			removed: [],
			added: [0]
		},
		{
			type: "spliceArray",
			index: 0,
			removed: [1],
			added: []
		},
		{
			type: "spliceArray",
			index: 2,
			removed: [],
			added: [1, 2]
		},
		{
			type: "spliceArray",
			index: 1,
			removed: [0, 1],
			added: [3, 4]
		},
		{
			type: "spliceArray",
			index: 0,
			removed: [3, 3, 4, 2],
			added: ["a"]
		},
		{
			type: "spliceArray",
			index: 0,
			removed: ["a"],
			added: []
		}
	];

	expect(buf).toEqual(result);

	disposer();
	ar[0] = 5;
	expect(buf).toEqual(result);
});

test("basic functionality", function() {
	const a = array([]);
	expect(a.length).toBe(0);
	expect(Object.keys(a)).toEqual([]);
	expect(a.slice()).toEqual([]);

	a.push(1);
	expect(a.length).toBe(1);
	expect(a.slice()).toEqual([1]);

	a[1] = 2;
	expect(a.length).toBe(2);
	expect(a.slice()).toEqual([1, 2]);

	const sum = computed(function() {
		return (
			-1 +
			a.reduce(function(a, b) {
				return a + b;
			}, 1)
		);
	});

	expect(sum.get()).toBe(3);

	a[1] = 3;
	expect(a.length).toBe(2);
	expect(a.slice()).toEqual([1, 3]);
	expect(sum.get()).toBe(4);

	a.splice(1, 1, 4, 5);
	expect(a.length).toBe(3);
	expect(a.slice()).toEqual([1, 4, 5]);
	expect(sum.get()).toBe(10);

	a.splice(1, 1);
	expect(sum.get()).toBe(6);
	expect(a.slice()).toEqual([1, 5]);

	a.length = 4;
	expect(isNaN(sum.get())).toBe(true);
	expect(a.length).toEqual(4);

	expect(a.slice()).toEqual([1, 5, undefined, undefined]);

	a.length = 2;
	expect(sum.get()).toBe(6);
	expect(a.slice()).toEqual([1, 5]);

	expect(a.slice().reverse()).toEqual([5, 1]);
	expect(a.slice()).toEqual([1, 5]);

	a.unshift(3);
	expect(a.slice().sort()).toEqual([1, 3, 5]);
	expect(a.slice()).toEqual([3, 1, 5]);

	expect(JSON.stringify(a)).toBe("[3,1,5]");

	expect(a[1]).toBe(1);
	a[2] = 4;
	expect(a[2]).toBe(4);

	expect(Object.keys(a)).toEqual(["0", "1", "2"]);
});

test("find(findIndex)", function() {
	const a = array([10, 20, 20]);
	function predicate(item) {
		if (item === 20) {
			return true;
		}
		return false;
	}
	[].findIndex;
	expect(a.find(predicate)).toBe(20);
	expect(a.findIndex(predicate)).toBe(1);
	expect(a.find(predicate)).toBe(20);
});

test("concat should automatically slice observable arrays", () => {
	const a1 = array([1, 2]);
	const a2 = array([3, 4]);
	expect(a1.concat(a2)).toEqual([1, 2, 3, 4]);
});

test("concat stores targets and returns observables", () => {
	const a1 = array();
	const a2 = [{}, {}, {}, {}];
	const a3 = a1.concat(a2, {}, [observable({})]);
	expect(a3.length).toBe(6);
	expect(isObservable(a3)).toBe(true);
	a3.forEach(v => expect(isObservable(v)).toBe(true));
	getObservableSource(a3).forEach(v => expect(isObservable(v)).toBe(false));
});

test("array modification1", function() {
	const a = array([1, 2, 3]);
	const r = a.splice(-10, 5, 4, 5, 6);
	expect(a.slice()).toEqual([4, 5, 6]);
	expect(r).toEqual([1, 2, 3]);
});

test("serialize", function() {
	const a = [1, 2, 3];
	const m = array(a);

	expect(JSON.stringify(m)).toEqual(JSON.stringify(a));

	expect(a).toEqual(m.slice());
});

test("array modification functions", function() {
	const ars = [[], [1, 2, 3]];
	const funcs = ["push", "pop", "shift", "unshift"];
	funcs.forEach(function(f) {
		ars.forEach(function(ar) {
			const a = ar.slice();
			const b = array(a.slice());
			const res1 = a[f](4);
			const res2 = b[f](4);
			expect(res1).toEqual(res2);
			expect(a).toEqual(b.slice());
		});
	});
});

test("array modifications", function() {
	const a2 = array([]);
	const inputs = [undefined, -10, -4, -3, -1, 0, 1, 3, 4, 10];
	const arrays = [
		[],
		[1],
		[1, 2, 3, 4],
		[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
		[1, undefined],
		[undefined]
	];
	for (let i = 0; i < inputs.length; i++)
		for (let j = 0; j < inputs.length; j++)
			for (let k = 0; k < arrays.length; k++)
				for (let l = 0; l < arrays.length; l++) {
					[
						"array mod: [",
						arrays[k].toString(),
						"] i: ",
						inputs[i],
						" d: ",
						inputs[j],
						" [",
						arrays[l].toString(),
						"]"
					].join(" ");
					const a1 = arrays[k].slice();
					a2.splice(0, a2.length, ...a1);

					// eslint-disable-next-line prefer-spread
					const res1 = a1.splice.apply(
						a1,
						[inputs[i], inputs[j]].concat(arrays[l])
					);
					// eslint-disable-next-line prefer-spread
					const res2 = a2.splice.apply(
						a2,
						[inputs[i], inputs[j]].concat(arrays[l])
					);
					expect(a1.slice()).toEqual(a2.slice());
					expect(res1).toEqual(res2);
					expect(a1.length).toBe(a2.length);
				}
});

test("is array", function() {
	const x = array([]);
	expect(x instanceof Array).toBe(true);

	// would be cool if this would return true...
	expect(Array.isArray(x)).toBe(true);
});

test("stringifies same as ecma array", function() {
	const x = array([]);
	expect(x instanceof Array).toBe(true);

	// would be cool if these two would return true...
	expect(x.toString()).toBe("");
	expect(x.toLocaleString()).toBe("");
	x.push(1, 2);
	expect(x.toString()).toBe("1,2");
	expect(x.toLocaleString()).toBe("1,2");
});

test("observes when stringified", function() {
	const x = array([]);
	let c = 0;
	autorun(function() {
		x.toString();
		c++;
	});
	x.push(1);
	expect(c).toBe(2);
});

test("observes when stringified to locale", function() {
	const x = array([]);
	let c = 0;
	autorun(function() {
		x.toLocaleString();
		c++;
	});
	x.push(1);
	expect(c).toBe(2);
});

test("react to sort changes", function() {
	const x = array([4, 2, 3]);
	const sortedX = computed(function() {
		return x.slice().sort();
	});
	let sorted;

	autorun(function() {
		sorted = sortedX.get();
	});

	expect(x.slice()).toEqual([4, 2, 3]);
	expect(sorted).toEqual([2, 3, 4]);
	x.push(1);
	expect(x.slice()).toEqual([4, 2, 3, 1]);
	expect(sorted).toEqual([1, 2, 3, 4]);
	x.shift();
	expect(x.slice()).toEqual([2, 3, 1]);
	expect(sorted).toEqual([1, 2, 3]);
});

test("autoextend buffer length", function() {
	const ar = array(new Array(1000));
	let changesCount = 0;
	autorun(() => (ar.length, ++changesCount));

	ar[ar.length] = 0;
	ar.push(0);

	expect(changesCount).toBe(3);
});

test("array exposes correct keys", () => {
	const keys = [];
	const ar = array([1, 2]);
	for (const key in ar) keys.push(key);

	expect(keys).toEqual(["0", "1"]);
});

test("can iterate arrays", () => {
	const x = array([]);
	const y = [];
	const d = reaction(
		() => Array.from(x),
		items => y.push(items)
	);

	y.push(Array.from(x));
	x.push("a");
	x.push("b");
	expect(y).toEqual([[], ["a"], ["a", "b"]]);
	d();
});

test("iteration returns observable results", () => {
	const arr = array([{}, {}, {}]);
	const itr = arr[Symbol.iterator]();

	let i = itr.next();
	let count = 0;

	while (!i.done) {
		count++;
		expect(isObservable(i.value)).toBe(true);
		i = itr.next();
	}

	expect(count).toBe(3);
});

test("array is concat spreadable", () => {
	const x = array([1, 2, 3, 4]);
	const y = [5].concat(x);
	expect(y.length).toBe(5);
	expect(y).toEqual([5, 1, 2, 3, 4]);
});

test("array is spreadable", () => {
	const x = array([1, 2, 3, 4]);
	expect([5, ...x]).toEqual([5, 1, 2, 3, 4]);

	const y = array([]);
	expect([5, ...y]).toEqual([5]);
});

test("array supports toStringTag", () => {
	const a = array([]);
	expect(Object.prototype.toString.call(a)).toBe("[object Array]");
});

test("slice works", () => {
	const a = array([1, 2, 3]);
	expect(a.slice(0, 2)).toEqual([1, 2]);
});

test("slice is reactive", () => {
	const a = array([1, 2, 3]);
	let ok = false;
	reaction(
		() => a.slice().length,
		l => l === 4 && (ok = true)
	);
	expect(ok).toBe(false);
	a.push(1);
	expect(ok).toBe(true);
});

test("toString", () => {
	expect(array([1, 2]).toString()).toEqual([1, 2].toString());
	expect(array([1, 2]).toLocaleString()).toEqual([1, 2].toLocaleString());
});

test("can define properties on arrays", () => {
	const ar = array([1, 2]);
	Object.defineProperty(ar, "toString", {
		enumerable: false,
		configurable: true,
		value: function() {
			return "hoi";
		}
	});

	expect(ar.toString()).toBe("hoi");
	expect("" + ar).toBe("hoi");
});

test("symbol key on array", () => {
	const x = array([1, 2]);
	const s = Symbol("test");
	x[s] = 3;
	expect(x[s]).toBe(3);

	let reacted = false;
	const d = reaction(
		() => x[s],
		() => {
			reacted = true;
		}
	);

	x[s] = 4;
	expect(x[s]).toBe(4);

	// although x[s] can be stored, it won't be reactive!
	expect(reacted).toBe(false);
	d();
});

test("non-symbol key on array", () => {
	const x = array([1, 2]);
	const s = "test";
	x[s] = 3;
	expect(x[s]).toBe(3);

	let reacted = false;
	const d = reaction(
		() => x[s],
		() => {
			reacted = true;
		}
	);

	x[s] = 4;
	expect(x[s]).toBe(4);

	// although x[s] can be stored, it won't be reactive!
	expect(reacted).toBe(false);
	d();
});

["indexOf", "includes", "lastIndexOf"].forEach(method => {
	test(`Array.prototype.${method} method is observable`, () => {
		let count = 0;
		const lookup = {};
		const observedLookup = observable(lookup);
		const arr = array([{}, lookup, {}, lookup, {}, lookup]);

		const realArr = [{}, lookup, {}, lookup];

		autorun(() => {
			count++;

			expect(arr[method](observedLookup, 2)).toBe(realArr[method](lookup, 2));
		});

		realArr.push(0);
		arr.push(0);
		expect(count).toBe(2);
	});
});

["join", "toString", "toLocaleString"].forEach(method => {
	test(`Array.prototype.${method} method is observable`, () => {
		let count = 0;
		const arr = array([1, 2, 3]);
		const realArr = [1, 2, 3];

		autorun(() => {
			count++;

			expect(arr[method]("en")).toBe(realArr[method]("en"));
		});

		realArr.push(4);
		arr.push(4);
		expect(count).toBe(2);
	});
});

["concat", "slice", "flat"].forEach(method => {
	test(`Array.prototype.${method} method is observable`, () => {
		let count = 0;
		const realArr = [{}, 2, 3, 4];
		const arr = array([{}, 2, 3, 4]);

		autorun(() => {
			count++;
			const result = arr[method]();

			expect(result).toEqual(realArr[method]());
			expect(isObservable(result)).toBe(true);
			expect(isObservable(result[0])).toBe(true);
		});

		realArr.push(5);
		arr.push(5);
		expect(count).toBe(2);
	});
});

[
	"every",
	"filter",
	"forEach",
	"map",
	"flatMap",
	"find",
	"findIndex",
	"some"
].forEach(method => {
	test(`Array.prototype.${method} method is observable`, () => {
		let count = 0;
		const arr = array([{}, {}, {}]);
		const context = {};

		autorun(() => {
			let ran = false;
			count++;

			arr[method](function(v, i, a) {
				ran = true;
				expect(a).toBe(arr);
				expect(v).toBe(arr[i]);
				expect(this).toBe(context);

				return true;
			}, context);

			expect(ran).toBe(true);
		});

		arr.push({});
		expect(count).toBe(2);
		arr[0].prop = "value";
		expect(count).toBe(2);
	});
});

["reduce", "reduceRight"].forEach(method => {
	test(`Array.prototype.${method} method is observable`, () => {
		let count = 0;
		const arr = array([{}, {}, {}]);

		autorun(() => {
			let ran = false;
			count++;

			const res = arr[method](function(acc, v, i, a) {
				ran = true;
				expect(a).toBe(arr);
				expect(v).toBe(arr[i]);

				return acc;
			}, {});

			expect(isObservable(res)).toBe(true);

			expect(ran).toBe(true);
		});

		arr.push({});
		expect(count).toBe(2);
		arr[0].prop = "value";
		expect(count).toBe(2);
	});
});

test("observable values do not get stored on the original target", () => {
	const target = [];
	const a = array(target);
	const oTarget = { prop: "value" };
	const o = observable(oTarget);
	a[0] = o;
	expect(a[0]).toBe(o);
	expect(target[0]).not.toBe(o);
	expect(target[0]).toEqual(a[0]);
	expect(target[0]).toBe(oTarget);
});

test("observable values do not get stored on the original target (push)", () => {
	const target = [];
	const a = array(target);
	const oTarget = { prop: "value" };
	const o = observable(oTarget);
	a.push(o);
	expect(a[0]).toBe(o);
	expect(target[0]).not.toBe(o);
	expect(target[0]).toEqual(a[0]);
	expect(target[0]).toBe(oTarget);
});