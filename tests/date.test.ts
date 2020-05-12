import { observable, autorun } from "../src";

test("date methods return values", () => {
	const now = new Date().getMonth();
	const d = observable(new Date());

	expect(d.getMonth()).toBe(now);
});

test("date methods are reactive", () => {
	const d = observable(new Date());

	let count = 0;

	autorun(() => {
		d.getDate();
		count++;
	});

	d.setFullYear(d.getFullYear() + 1);
	expect(count).toBe(2);
});

test("date toString returns epoch", () => {
	const now = Date.now();
	const rd = new Date(now);

	const d = observable(new Date(now));

	expect(d.valueOf()).toEqual(rd.valueOf());
	expect(+d).toEqual(+rd);
});
