import { autorun, observable, reaction, computed } from "../src";

describe("observable tests", () => {
  it("can read observable box value", () => {
    const a = observable(1);
    expect(a.get()).toBe(1);
  });

  it("can set an observable box value", () => {
    const a = observable(0);
    a.set(1);
    expect(a.get()).toBe(1);
  });

  it("can react to an observable change", () => {
    const a = observable(0);
    let count = 0;
    reaction(
      () => a.get(),
      () => count++
    );
    expect(count).toBe(0);
    a.set(1);
    expect(count).toBe(1);
  });

  it("does not trigger a reaction for same value", () => {
    const value = {};
    const a = observable(value);
    let count = 0;
    reaction(
      () => a.get(),
      () => count++
    );
    a.set(value);
    expect(count).toBe(0);
    a.set({});
    expect(count).toBe(1);
  });

  it("accepts a comparator function", () => {
    let countEquals = 0;
    let countReaction = 0;

    const equals = (a, b) => {
      countEquals++;
      return a.prop === b.prop;
    };

    const o = observable({ prop: 0 }, { equals });
    expect(countEquals).toBe(0);

    autorun(() => {
      o.get();
      countReaction++;
    });

    expect(countEquals).toBe(0);
    expect(countReaction).toBe(1);
    o.set({ prop: 0 });
    expect(countEquals).toBe(1);
    expect(countReaction).toBe(1);
    o.set({ prop: 1 });
    expect(countEquals).toBe(2);
    expect(countReaction).toBe(2);
  });

  it("accepts a onBecomeObserved/onBecomeUnobserved callbacks", () => {
    let countObserved = 0;
    let countUnObserved = 0;

    const onBecomeObserved = () => countObserved++;
    const onBecomeUnobserved = () => countUnObserved++;

    const o = observable(0, { onBecomeObserved, onBecomeUnobserved });

    expect(countObserved).toBe(0);
    expect(countUnObserved).toBe(0);

    const u = autorun(() => {
      o.get();
    });

    expect(countObserved).toBe(1);
    expect(countUnObserved).toBe(0);

    u();

    expect(countObserved).toBe(1);
    expect(countUnObserved).toBe(1);

    const u2 = autorun(() => {
      o.get();
    });

    expect(countObserved).toBe(2);
    expect(countUnObserved).toBe(1);

    u2();

    expect(countObserved).toBe(2);
    expect(countUnObserved).toBe(2);
  });

  //from mobx
  it("nested observables", () => {
    const factor = observable(0);
    const price = observable(100);
    let totalCalcs = 0;
    let innerCalcs = 0;

    const total = computed(function() {
      totalCalcs += 1; // outer observable shouldn't recalc if inner observable didn't publish a real change
      return (
        price.get() *
        computed(function() {
          innerCalcs += 1;
          return factor.get() % 2 === 0 ? 1 : 3;
        }).get()
      );
    });

    const b = [];

    autorun(() => b.push(total.get()));

    price.set(150);
    factor.set(7); // triggers innerCalc twice, because changing the outcome triggers the outer calculation which recreates the inner calculation
    factor.set(5); // doesn't trigger outer calc
    factor.set(3); // doesn't trigger outer calc
    factor.set(4); // triggers innerCalc twice
    price.set(20);

    expect(b).toEqual([100, 150, 450, 150, 20]);
    expect(innerCalcs).toBe(9);
    expect(totalCalcs).toBe(5);
  });

  //from mobx
  it("multiple view dependencies", function() {
    let bCalcs = 0;
    let dCalcs = 0;
    const a = observable(1);
    const b = computed(function() {
      bCalcs++;
      return 2 * a.get();
    });
    const c = observable(2);
    const d = computed(function() {
      dCalcs++;
      return 3 * c.get();
    });

    let zwitch = true;
    const buffer = [];
    let fCalcs = 0;
    const dis = autorun(function() {
      fCalcs++;
      if (zwitch) buffer.push(b.get() + d.get());
      else buffer.push(d.get() + b.get());
    });

    zwitch = false;
    c.set(3);
    expect(bCalcs).toBe(1);
    expect(dCalcs).toBe(2);
    expect(fCalcs).toBe(2);
    expect(buffer).toEqual([8, 11]);

    c.set(4);
    expect(bCalcs).toBe(1);
    expect(dCalcs).toBe(3);
    expect(fCalcs).toBe(3);
    expect(buffer).toEqual([8, 11, 14]);

    dis();
    c.set(5);
    expect(bCalcs).toBe(1);
    expect(dCalcs).toBe(3);
    expect(fCalcs).toBe(3);
    expect(buffer).toEqual([8, 11, 14]);
  });
});
