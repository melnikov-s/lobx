# lobx

lobx is a stripped down version of [mobx](https://github.com/mobxjs/mobx) primarily meant to be used in library/framework code that needs mobx like observables. It comes in at just over 2k (min + gzip) compared to 30k for mobx but only comes with boxed values. Although it does come with the primitives required to build your own types. (Array, Map, Object, etc)

If you're new to mobx then you can check out their excellent [getting started guide](https://github.com/mobxjs/mobx#getting-started). The documentation here is slim as knowledge of mobx concepts and API is assumed.

## Browser Support

IE11 and above. Or any ES5 environment with Map and Set

## vs Mobx

### Behaviors

As much as possible lobx tries to mimic mobx behaviors in terms of how computed chaching works, when observers are considered "observed", when reactions should react, etc. Though 100% parity between mobx is not guaranteed.

### Performance

lobx has comparable or better performance to mobx according to mobx own benchmarks. Though like all benchmarks they might not be representative of real world scenarios.

```
> npm run test:perf
 -------- lobx results --------
    One observers many observes one - Started/Updated in 7.83/18.27 ms.
    500 props observing sibling -  Started/Updated in 0.27/1.08 ms.
    Late dependency change - Updated in 1.80ms.
    Unused computables -   Updated in 0.20 ms.
    Unused observables -  Updated in 9.21 ms.
    computed memoization 0.08 ms.

    -------- mobx results --------
    One observers many observes one - Started/Updated in 22.51/25.99 ms.
    500 props observing sibling -  Started/Updated in 0.79/1.55 ms.
    Late dependency change - Updated in 13.36ms.
    Unused computables -   Updated in 0.49 ms.
    Unused observables -  Updated in 36.98 ms.
    computed memoization 0.14 ms.
```

## API and Usage

_Note: lobx is not API compatible with mobx._

### `observable(value, { equals?, onBecomeObserved?, onBecomeUnobserved?, graph? })`

Wrap single value with an observable context.
_mobx equivalent: `observable.box`_

```javascript
import { observable } from "lobx";

const name = observable("Alice");
console.log(name.get()); // Alice
name.set("Bob");
console.log(name.get()); // Bob
```

#### Options:

- `equals` default: `(a, b) => a === b || (a !== a && b !== b)`. By default a computed is considered changed if it produces a new reference. A custom `equals` method can be provided if for example you need to compare by value. If `equals` returns false then observers further down the graph will not be re-evaluated.
- `onBecomeObserved` callback for when the observable is first observed
- `onBecomeUnobserved` callback for when the observable is no longer observed

#### Methods:

- `get()`: returns the current value
- `set(newValue)`: sets a new value
- `equals(value): boolean`: uses the passed in comparator to determine if a value is equal to the current observable value.

### `computed(fn, { keepAlive = false, equals?, onBecomeObserved?, onBecomeUnobserved?, graph? })`

Derive a new value from observables

```javascript
import { observable, computed } from "lobx";

const firstName = observable("Alice");
const lastName = observable("Smith");
const fullName = computed(() => `${firstName.get()} ${lastName.get()}`);
console.log(fullName.get()); // Alice Smith
```

#### Options:

- `keepAlive` default: `false`. Does not clear out the computed value once the computed is no longer observed
- `equals` default: `(a, b) => a === b || (a !== a && b !== b)`. By default a computed is considered changed if it produces a new reference. A custom `equals` method can be provided if for example you need to compare by value. If `equals` returns false then observers further down the graph will not be re-evaluated.
- `onBecomeObserved` callback for when the computed is first observed
- `onBecomeUnobserved` callback for when the computed is no longer observed

#### Methods:

- `get()`: derive (if needed) a value and return it
- `equals(value): boolean`: uses the passed in comparator to determine if a value is equal to the current computed value. Might derive.
- `isDirty(): boolean`: returns `true` if computed needs to derive a value, `false` if it has already derived and cached one.
- `isKeepAlive(): boolean`: returns `true` if the computed is `keepAlive`, `false` otherwise.
- `setKeepAlive(keepAlive: boolean)`: change `keepAlive` , if the computed was `keepAlive` and is no longer observed will clear out the cached value.

### `autorun(callback, { graph? })`

Perform a side effect each time from when an observable value changes. Runs immediately.

```javascript
import { observable, computed, autorun } from "lobx";

const firstName = observable("Alice");
const lastName = observable("Smith");
const fullName = computed(() => `${firstName.get()} ${lastName.get()}`);
const unsub = autorun(() => console.log(fullName())); //Alice Smith
firstName.set("Bob"); // Bob Smith
unsub(); // unsubscribes from future updates
```

### `reaction(tracker, callback, { graph? })`

Similar to `autorun` but splits the observation and effect into separate functions. Observation runs immediately whereas effect runs on change. The observation callback expects a returned value which will then be passed into the effect callback. If the value has not changed since the last run then the effect callback will not be invoked.

```javascript
import { observable, computed, reaction } from "lobx";

const firstName = observable("Alice");
const lastName = observable("Smith");
const fullName = computed(() => `${firstName.get()} ${lastName.get()}`);
const unsub = reaction(
  () => fullName.get(),
  name => console.log(name)
);
firstName.set("Bob"); // Bob Smith
lastName.set("Jones"); // Bob Jones
unsub(); // unsubscribes from future updates
```

### `action(fn, { graph? })`

An action allows you to mutate multiple observables and hold off reactions until the (outer most) action has completed. This prevents reactions of triggering on intermediate observable values.

```javascript
import { observableObject, autorun, action } from "lobx";

const firstName = observable("Alice");
const lastName = observable("Smith");
const fullName = computed(() => `${firstName.get()} ${lastName.get()}`);

autorun(() => console.log(fullName.get())); //Alice Smith

const changeName = action(() => {
  firstName.set("Bob");
  lastName.set("Jones");
});

//execute the action
changeName(); // Bob Jones
```

### `runInAction(fn, { graph? })`

Just like `action` but instead of returning a function that can be later executed it will immediately execute the function passed in.

```javascript
import { observableObject, autorun, runInAction } from "lobx";

const firstName = observable("Alice");
const lastName = observable("Smith");
const fullName = computed(() => `${firstName.get()} ${lastName.get()}`);

autorun(() => console.log(fullName.get())); //Alice Smith

runInAction(() => {
  firstName.set("Bob");
  lastName.set("Jones");
}); // Bob Jones
```

### `atom({ onBecomeObserved?, onBecomeUnobserved?, graph? })`

A `atom` is a generic observable that enables the creation of custom observable types. It only has two methods; `reportChanged` and `reportObserved`. These methods are used to inform lobx as to when your observable has been read or written to.

There are hooks for when a node becomes observed and unobserved by passing in the `onBecomeObserved` and `onBecomeUnobserved` callbacks when creating a node.

_mobx equivalent: `createAtom`_

```javascript
// example adapted from mobx
import { atom, autorun } from "lobx";

class Clock {
  atom;
  intervalHandler = null;
  currentDateTime;

  constructor() {
    // creates an node to interact with the lobx core algorithm
    this.atom = atom(
      // first (optional) parameter: callback for when this node transitions from unobserved to observed.
      () => this.startTicking(),
      // second (optional) parameter: callback for when this node transitions from observed to unobserved
      // note that the same node transitions multiple times between these two states
      () => this.stopTicking()
    );
  }

  getTime() {
    // let lobx know this observable data source has been used
    // reportObserved will return true if the node is currently being observed
    // by some reaction.
    // reportObserved will also trigger the onBecomeObserved event handler (startTicking) if needed
    if (this.atom.reportObserved()) {
      return this.currentDateTime;
    } else {
      // apparently getTime was called but not while a reaction is running.
      // So, nobody depends on this value, hence the onBecomeObserved handler (startTicking) won't be fired
      // Depending on the nature of your node
      // it might behave differently in such circumstances
      // (like throwing an error, returning a default value etc)
      return new Date();
    }
  }

  tick() {
    this.currentDateTime = new Date();
    // let lobx know that this data source has changed
    this.atom.reportChanged();
  }

  startTicking() {
    this.tick(); // initial tick
    this.intervalHandler = setInterval(() => this.tick(), 1000);
  }

  stopTicking() {
    clearInterval(this.intervalHandler);
    this.intervalHandler = null;
  }
}

const clock = new Clock();

const disposer = autorun(() => console.log(clock.getTime()));

// ... prints the time each second

setTimeout(() => disposer(), 10000);

// printing stops. If nobody else uses the same `clock` the clock will stop ticking as well
```

#### Methods:

- `reportChanged()`: signal that an atom has changed
- `reportObserved(): boolean` - signal that an atom is observed. `true` is returned if the observation occurred within a derivation.

### `listener(callback, { graph? })`

`listener` is what `autorun` and `reaction` are built on. It can be used to build custom reactions or as a more generic alternative to `autorun` and `reaction`. It accepts a `callback` function and returns an object with two methods: `track` and `dispose`.

_mobx equivalent: `Reaction`_

```javascript
import { observable, listener } from "lobx";

const firstName = observable("Alice");
const lastName = observable("Smith");
const l = listener(() => console.log("observable chaged!"));
l.track(() => firstName.get());
firstName.set("Bob"); // logs "observable changed!";
l.track(() => lastName.get()); // change tracking to lastName
firstName.set("Charlie"); // nothing logged;
lastName.set("Jones"); // logs "observable changed!";
l.dispose();
lastName.set("White"); // disposed, logs nothing;
```

### Methods:

- `track(fn: Function)`: call a method and track any observables read in it. If those observables change it will trigger the `callback` method passed into `listener`
- `dispose()`: unsubscribe from the listener

### `untracked(fn, { graph? })`

Run a function without establishing observers.

### `isInAction({ graph? })`

Returns a `boolean` as to whether or not we're currently within an action

### `isTracking({ graph? })`

Returns a `boolean` as to whether or not we're currently in a derivation (`computed`, `autorun`, `reaction`, `listener`)

### `isObserved(observable | computed | atom, { graph? })`

Returns a `boolean` as to whether or not an observable node is currently being observed in a derivation

### `graph()`

A graph orchestrates all observable actions and reactions. Observables and derivations are all nodes on this graph. By default lobx will automatically create a graph which will be used for all nodes unless otherwise provided within the options. Creating a new graph and adding nodes to it, isolates those nodes from those added to the default graph or other graphs.

_mobx equivalent: `isolateGlobalState`_

```javascript
import { graph, observable, listener } from "lobx";

const newGraph = graph();
const o = observable(0, { graph: newGraph });
autorun(() => o.get());
o.set(o.get() + 1); // will not react as the listener node created by autorun and the observable live on different graphs
autorun(() => o.get(), { graph: newGraph });
o.set(o.get() + 1); // listener created above will react as both the listener and observable node were created on the same graph
```

### `getDefaultGraph()`

Returns the default graph created by lobx.

# Thanks

To the contributors of mobx and surrounding libraries for their amazing work.
