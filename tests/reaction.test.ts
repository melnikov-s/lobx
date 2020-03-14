import { observable, computed, reaction, autorun } from "../src";

describe("reaction tests", () => {
  it("runs the track method initially", () => {
    let count = 0;
    reaction(
      () => count++,
      () => {}
    );
    expect(count).toBe(1);
  });

  it("re-runs the track method when an observable value changes", () => {
    let count = 0;
    const o = observable(0);
    reaction(
      () => {
        count++;
        return o.get();
      },
      () => {}
    );
    expect(count).toBe(1);
    o.set(1);
    expect(count).toBe(2);
  });

  it("passes the value returned from the track method into the callback", () => {
    let value = 0;
    const o = observable(0);
    reaction(
      () => {
        return o.get();
      },
      v => {
        value = v;
      }
    );

    o.set(1);
    expect(value).toBe(1);
  });

  it("runs the callback method when an observable value changes", () => {
    let count1 = 0;
    let count2 = 0;
    const o1 = observable(0);
    const o2 = observable(0);
    const c1 = computed(() => o2.get() * 2);
    const c2 = computed(() => o1.get() * 2);
    reaction(
      () => o1.get() + c1.get() + c2.get(),
      () => count1++
    );
    reaction(
      () => c2.get(),
      () => count2++
    );
    expect(count1).toBe(0);
    expect(count2).toBe(0);
    o1.set(1);
    expect(count1).toBe(1);
    expect(count2).toBe(1);
    o1.set(2);
    expect(count1).toBe(2);
    expect(count2).toBe(2);
    o2.set(1);
    expect(count1).toBe(3);
    expect(count2).toBe(2);
  });

  it("does not run the callback when the same value is returned", () => {
    let count = 0;
    const o1 = observable(0);
    const o2 = observable(0);
    reaction(
      () => o1.get() * 0 + o2.get(),
      () => count++
    );
    o1.set(1);
    expect(count).toBe(0);
    o2.set(1);
    expect(count).toBe(1);
  });

  it("does not call the callback when unsubscribed", () => {
    let count = 0;
    const o = observable(0);
    const u = reaction(
      () => o.get(),
      () => count++
    );
    o.set(1);
    expect(count).toBe(1);
    u();
    o.set(2);
    expect(count).toBe(1);
  });

  it("does not call the track function when unsubscribed", () => {
    let count = 0;
    const o = observable(0);
    const u = reaction(
      () => {
        count++;
        return o.get();
      },
      () => {}
    );
    expect(count).toBe(1);
    o.set(1);
    expect(count).toBe(2);
    u();
    o.set(2);
    expect(count).toBe(2);
  });

  it("can mutate observables in the callback", () => {
    let count = 0;
    const o1 = observable(0);
    const o2 = observable(1);
    const c = computed(() => o2.get() * 2);
    reaction(
      () => {
        return o1.get();
      },
      () => {
        o2.set(o2.get() + 1);
      }
    );
    o1.set(1);
    expect(c.get()).toBe(4);
    autorun(() => {
      count++;
      c.get();
    });
    o1.set(2);
    expect(c.get()).toBe(6);
    expect(count).toBe(2);
  });

  it("does not react to stale observables", () => {
    let count = 0;
    const o1 = observable(true);
    const o2 = observable(1);
    const o3 = observable(2);

    reaction(
      () => (o1.get() ? o2.get() : o3.get()),
      () => count++
    );
    o1.set(false);
    expect(count).toBe(1);
    o2.set(3);
    expect(count).toBe(1);
    o3.set(4);
    expect(count).toBe(2);
  });
});
