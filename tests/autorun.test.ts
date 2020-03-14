import { observable, autorun } from "../src";

describe("autorun tests", () => {
  it("runs the callback initially", () => {
    let count = 0;
    autorun(() => count++);
    expect(count).toBe(1);
  });

  it("can be disposed on first run", function() {
    const o = observable(1);
    const values = [];

    autorun(r => {
      r.dispose();
      values.push(o.get());
    });

    o.set(2);

    expect(values).toEqual([1]);
  });

  it("runs the callback everytime an observer is changed", () => {
    let count = 0;
    const o = observable(0);
    autorun(() => {
      count++;
      o.get();
    });
    expect(count).toBe(1);
    o.set(1);
    expect(count).toBe(2);
  });

  it("does not run the callback when unsubscribed", () => {
    let count = 0;
    const o = observable(0);
    const u = autorun(() => {
      o.get();
      count++;
    });
    expect(count).toBe(1);
    o.set(1);
    expect(count).toBe(2);
    u();
    o.set(2);
    expect(count).toBe(2);
  });

  // from mobx
  it("autoruns created in autoruns should kick off", () => {
    const x = observable(3);
    const x2 = [];
    let d;

    autorun(function() {
      if (d) {
        // dispose previous autorun
        d();
      }
      d = autorun(function() {
        x2.push(x.get() * 2);
      });
    });

    x.set(4);
    expect(x2).toEqual([6, 8]);
  });
});
