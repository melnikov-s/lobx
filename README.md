# lobx

`lobx` is a lighter alternative to a popular observable library [mobx](https://github.com/mobxjs/mobx). It weights in at about half the size of `mobx` while maintaining the majority of it's functionality but it also differs from how `mobx` handles observables. Where as `mobx` makes a deep copy of the data structure you're observing, `lobx` creates a lazy proxy shell over the original data thus making it ideal for observing large objects and/or server responses. It also offers an alternative approach around asynchronous actions and introduces some performance escape hatches.

If you're new to `mobx` then you can check out their excellent [documentation](https://mobx.js.org/about-this-documentation.html). Some of the documentation here is taken directly from `mobx`.

If you're already familiar with `mobx` you can skip to the [`lobx vs mobx`](#lobx-vs-mobx) part of the documentation.

## Introduction

_Anything that can be derived from the application state, should be. Automatically._

The philosophy behind `lobx` is simple:

<div class="benefits">
    <div>
        <div class="pic">😙</div>
        <div>
            <h5>Straightforward</h5>
            <p>Write minimalistic, boilerplate free code that captures your intent.
            Trying to update a record field? Use the good old JavaScript assignment.
            Updating data in an asynchronous process? No special tools are required, the reactivity system will detect all your changes and propagate them out to where they are being used.
            </p>
        </div>
    </div>
    <div>
        <div class="pic">🚅</div>
        <div>
            <h5>Effortless optimal rendering</h5>
            <p>
                All changes to and uses of your data are tracked at runtime, building a dependency tree that captures all relations between state and output.
                This guarantees that computations depending on your state, like React components, run only when strictly needed.
                There is no need to manually optimize components with error-prone and sub-optimal techniques like memoization and selectors.
            </p>
        </div>
    </div>
    <div>
        <div class="pic">🤹🏻‍♂️</div>
        <div>
            <h5>Architectural freedom</h5>
            <p>
                `lobx` is unopinionated and allows you to manage your application state outside of any UI framework.
                This makes your code decoupled, portable, and above all, easily testable.
            </p>
        </div>
    </div>
</div>

## A quick example

So what does code that uses `lobx` look like? That will all depend on how you want to model your state.

`lobx` is not an opinionated state management library or framework. It provides the reactive primitives while giving you the freedom to model your application state however you see fit. 

Here's an example of an object oriented approach using classes.

```javascript
import React from "react";
import ReactDOM from "react-dom";
import { Observable } from "lobx";
import { observer } from "lobx-react";

// Model the application state.
class Timer extends Observable {
	secondsPassed = 0;

	increase() {
		this.secondsPassed += 1;
	}

	reset() {
		this.secondsPassed = 0;
	}

	// derived state
	get minutesPassed() {
		return Math.floor(this.secondsPassed / 60);
	}
}

const myTimer = new Timer();

// Build a "user interface" that uses the observable state.
const TimerView = observer(({ timer }) => (
	<button onClick={() => timer.reset()}>
		Seconds passed: {timer.secondsPassed}, Minutes Passed: {timer.minutesPassed}
	</button>
));

ReactDOM.render(<TimerView timer={myTimer} />, document.body);

// Update the 'Seconds passed: X' text every second.
setInterval(() => {
	myTimer.increase();
}, 1000);
```

And here's an example without using classes, where the model is just a plain object and we define methods to mutate it.

```javascript
import React from "react";
import ReactDOM from "react-dom";
import { observable } from "lobx";
import { observer } from "lobx-react";

// Model application state
const myTimer = observable({
	secondsPassed: 0,
	increase() {
		this.secondsPassed += 1;
	},
	reset() {
		this.secondsPassed = 0;
	},
	// derived state
	get minutesPassed() {
		return Math.floor(this.secondsPassed / 60);
	},
});

// Build a "user interface" that uses the observable state.
const TimerView = observer(({ timer }) => (
	<button onClick={() => timer.reset()}>
		Seconds passed: {timer.secondsPassed}, Minutes Passed: {timer.minutesPassed}
	</button>
));

ReactDOM.render(<TimerView timer={myTimer} />, document.body);

// Update the 'Seconds passed: X' text every second.
setInterval(() => {
	timer.increase();
}, 1000);
```

_Note: It is not required to have methods to mutate your observable objects. You can mutate them directly as long as strict actions are not enforced or use `action`_

In Both cases the behavior is the same.

The `observer` wrapper around the `TimerView` React component will automatically detect that rendering
depends on the `timer.secondsPassed` observable, even though this relationship is not explicitly defined. The reactivity system will take care of re-rendering the component when _precisely that_ field is updated in the future.

The `onClick` and `setInterval` callbacks invoke an _action_  that updates _observable state_.
Changes in the observable state are propagated precisely to all _computations_ and _side effects_ that depend on the changes being made.

## Browser / Runtime Support

Should work in any environment that supports ES2015 and Proxies

# lobx vs mobx

## How lobx handles observability vs Mobx

Where as `mobx` observes non-primitive values by first making a deep copy of them, `lobx` is instead designed to provide an observable proxied "shell" over the original reference. There can only be one proxied "shell" over each unique reference, observing the same reference more than once will return the same observable "shell".

The differences in observability approaches between `mobx` and `lobx` is best demonstrated with the following code snippets:

```javascript
// mobx example
import { observable } from "mobx";

const nonObservableObject = { value: { innerValue: 0 } };
const nonObservableArray = [nonObservableObject, nonObservableObject];
console.log(nonObservableArray[0] === nonObservableArray[1]); // true as they're both the same reference
const observableArray = observable(nonObservableArray);
console.log(observableArray[0] === observableArray[1]); // false , while they were the same reference in the non-observable array, mobx creates a new deep copy for each element making them unique
console.log(observableArray === observable(nonObservableArray)); // false, observing the same reference returns a new copy
observableArray.push("new value");
console.log(observableArray.length === nonObservableArray.length); // false, any mutation done to the observable copy will not be reflected in the original non-observed reference.
```

```javascript
// lobx example
import { observable } from "lobx";

const nonObservableObject = { value: { innerValue: 0 } };
const nonObservableArray = [nonObservableObject, nonObservableObject];
console.log(nonObservableArray[0] === nonObservableArray[1]); // true as they're both the same reference
const observableArray = observable(nonObservableArray);
console.log(observableArray[0] === observableArray[1]); // true, lobx always returns the same observable for each unique references which allows us to preserve referential equality within an object
console.log(observableArray === observable(nonObservableArray)); // true, for the same reason as above
observableArray.push("new value");
console.log(observableArray.length === nonObservableArray.length); // true, since an observable in lobx is just a proxied "shell" over the source reference any mutation done to it will also be reflected in the source.
```

The approach taken by `lobx` makes it a good choice for introducing observability to an existing code base. As you can observe existing data structures with practically no initialization over-head. The preservation of referential equality also reduces the risk of your application breaking from making an existing data structure observable. Even allowing you to observe objects with circular references.

_Note: while mutating the observable reference will also affect the non-observable source, the opposite is also true. Except that any changes made directly to the non-observable source will not be visible to `lobx` reactions. This is both a gotcha and a feature, as it allows for a performance escape-hatch to by-pass the overhead involved in mutating or reading the proxied observable by mutating/reading the source observable instead. `lobx` then provides an api to signal to reactions that an observable has been mutated or read via `forceChange` and `forceObserve`.
Though it is unlikely you will ever need to do this in your application._

_Further details can be found [here](#performance-escape-hatches-that-are-unique-to-lobx)_

## lobx async actions

`mobx` has a separate concept for async actions called `flow`. It requires developers to be familiar with generators instead of the more common `async/await` paradigm for asynchronous actions. If using typescript it also requires the usage of a `flowResult` wrapper function in order for typescript to infer the return type correctly. `lobx` takes a simpler approach here and sticks with `async/await`. All that is required is to wrap any awaited call with `task`.

Examples:

### mobx async example

```javascript
import { flow, makeAutoObservable, flowResult } from "mobx";

class Store {
	githubProjects = [];
	state = "pending";

	constructor() {
		makeAutoObservable(this, {
			fetchProjects: flow,
		});
	}

	// Note the star, this a generator function!
	*fetchProjects() {
		this.githubProjects = [];
		this.state = "pending";
		try {
			// Yield instead of await.
			const projects = yield fetchGithubProjectsSomehow();
			const filteredProjects = somePreprocessing(projects);
			this.state = "done";
			this.githubProjects = filteredProjects;
		} catch (error) {
			this.state = "error";
		}
	}
}

const store = new Store();
const projects = await flowResult(store.fetchProjects());
```

and here's the `lobx` equivalent:

### lobx async example

```javascript
import { Observable, task } from "lobx";

class Store extends Observable {
	githubProjects = [];
	state = "pending";

	// just a plain async function
	async fetchProjects() {
		this.githubProjects = [];
		this.state = "pending";
		try {
			// notice the `task` wrapper to the right of the `await`
			// this is all that's required to turn an `action` to an `async action`
			const projects = await task(fetchGithubProjectsSomehow());
			const filteredProjects = somePreprocessing(projects);
			this.state = "done";
			this.githubProjects = filteredProjects;
		} catch (error) {
			this.state = "error";
		}
	}
}

const store = new Store();
// no need for any additional wrappers here
const projects = await store.fetchProjects();
```

More details about async actions in `lobx` can be found [here](#async-actions)

## Performance escape hatches that are unique to lobx

When dealing with observable object proxies in either `lobx` or `mobx` there's an added overhead for every read and write operation that is performed on those objects. While this overhead is significant it rarely becomes a performance issue as in typical web applications data processing of state/domain objects is not the bottle neck. Yet there might be situations where heavy data manipulation is required and doing so on
an observable proxied object will be significantly slower then working with plain javascript objects.

`lobx` offers a performance escape hatch in these situation. Since observables in `lobx` are proxied shells over the original plain javascript object we can modify the object directly and then manually signal to `lobx` that the object has been changed so that all reactions that depend on it can be ran. This can be achieved using the `getObservableSource` and `forceChange` apis.

example:

```javascript
import { getObservableSource, forceChange } from "lobx";

// assuming `bigObj` is a large observable object

// get the original plain object source for this observable
const bigObjSource = getObservableSource(bigObj);
// perform expensive mutations on the plain javascript object (fast)
performExpensiveMutations(bigObjSource);
forceChange(bigObj); // manual signal to reactions that our object has changed and those reactions that depend on it need to re-run
```

There's also `forceObserve` which is the read equivalent to `forceChange`. It can be used when performing an expensive derivation within a reaction.

## Other significant differences vs Mobx

- `WeakMap` , `WeakSet` and even `Date` can be observable
- `Map` and `Set` are proxied and not their own class that rely on duck typing like `mobx`. So things like `observable(new Set()) instanceof Set` will return `true` in `lobx` while being `false` in `mobx`
- fine-grained scheduling of reactions, allowing you for example to only run reactions on `requestAnimationFrame` (also some-what possible in `mobx` but only as a global configuration)
- easy isolation of observable graphs if needed. (similar to `isolateGlobalState` from `mobx` but with finer grained control)
- `lobx` is missing the following features from `mobx`: `intercept`, `trace`, `spy`

## Is lobx a fork of Mobx?

The core of `lobx` is written from scratch while the types (`Array`, `Object`, `Map` etc) were initially brought in from `mobx` and have since been heavily modified. `lobx` does have a significant amount of test code from `mobx` brought in to ensure that both libraries have very similar derivation behaviors. Either way the existence of `lobx` would not have been possible without `mobx`.

## What can be made observable?

Any plain object can be made observable, as well as `Array`, `Map`, `Set`, `WeakMap`, `WeakSet` and `Date`.

Any non-plain object (one created with `class` for instance or whose prototype is not `Object.prototype`) will not be observed. Likewise with any frozen object (using `Object.freeze`)

## Reading from observable objects

With `lobx` observability is always deep. Every object accessed through a proxied observable will itself be observable.

```javascript
import { observable, isObservable } from "lobx";

const source = { inner: { values: [{ value: 0 }] }, value: 1 };
const observed = observable(source);
console.log(isObservable(observed)); //true;
console.log(isObservable(observed.inner)); // true;
console.log(isObservable(observed.inner[0])); // true
```

## Writing to observable objects

When writing to observable objects `lobx` will mutate the underlying source.
Yet it will avoid writing any observable values to the underlying source, so if an observable value A is set on a property of another observable object B, the source of B will have the source of A instead of the observable of A.

`lobx` will avoid setting observable values on source objects.

```javascript
import { observable, isObservable } from "lobx";

const source = { inner: { values: [{ value: 0 }] }, value: 1 };
const observed = observable(source);
const childSource = { value: 1 }; // plain object, not observed;
const childObserved = observable(childSource);
observed.inner[0] = childObserved; // set an observable object on another observable object
console.log(isObservable(observed.inner[0])); // true, we get back an observable object when accessing a property of another observable object
console.log(isObservable(source.inner[0])); // false, the source object did not get the observable set on it
console.log(source.inner[0] === childSource); // true, the source of the observable is what gets set on the source object;
```

## Configuring observable objects

By default when making an object observable each property of that object will become observable, getters will become computed and methods and setters will be actions. This behavior can be configured. This is done with `observable.configure` where the configuration is a map of object properties to one of `observable`, `computed` or `action`.

```javascript
const myObservable = observable.configure(
	{
		observableValue: observable,
		comp: computed,
		inc: action,
	},
	{
		observableValue: 0,
		nonObservableValue: 0,
		get comp() {
			return this.observableValue * 2;
		},
		inc() {
			this.observableValue++;
		},
	}
);
```

Providing a custom configuration overwrite the default behavior and gives you control over which properties are observable, computed or an action.

## Using lobx with React

To use `lobx` with `react` you will need an additional package [`lobx-react`](https://github.com/melnikov-s/lobx-react). All that is required to make a react component automatically re-render when an observable changes is to wrap it in a `observer`. 

Usage:

```javascript
import { observer } from "lobx-react".

const MyComponent = observer(props => ReactElement)
```

While `lobx` works independently from React, they are most commonly used together. 

```javascript
import React from "react"
import ReactDOM from "react-dom"
import { Observable } from "lobx"
import { observer } from "mobx-react-lite"

class Timer extends Observable {
    secondsPassed = 0

    increaseTimer() {
        this.secondsPassed += 1
    }
}

const myTimer = new Timer()

// A function component wrapped with `observer` will react
// to any future change in an observable it used before.
const TimerView = observer(({ timer }) => <span>Seconds passed: {timer.secondsPassed}</span>)

ReactDOM.render(<TimerView timer={myTimer} />, document.body)

setInterval(() => {
    myTimer.increaseTimer()
}, 1000)
```

The `observer` HoC automatically subscribes React components to _any observables_ that are used _during rendering_.
As a result, components will automatically re-render when relevant observables change.
It also makes sure that components don't re-render when there are _no relevant_ changes.
So, observables that are accessible by the component, but not actually read, won't ever cause a re-render.

In practice this makes `lobx` applications very well optimized out of the box and they typically don't need any additional code to prevent excessive rendering.

For `observer` to work, it doesn't matter _how_ the observables arrive in the component, only that they are read.
Reading observables deeply is fine, complex expression like `todos[0].author.displayName` work out of the box.
This makes the subscription mechanism much more precise and efficient compared to other frameworks in which data dependencies have to be declared explicitly or be pre-computed (e.g. selectors).

### Local and external state

There is great flexibility in how state is organized, since it doesn't matter (technically that is) which observables we read or where observables originated from.
The examples below demonstrate different patterns on how external and local observable state can be used in components wrapped with `observer`.

#### Using external state in `observer` components

<!--DOCUSAURUS_CODE_TABS-->
<!--using props-->

Observables can be passed into components as props (as in the example above):

```javascript
import { observer } from "lobx-react"

const myTimer = new Timer() // See the Timer definition above.

const TimerView = observer(({ timer }) => <span>Seconds passed: {timer.secondsPassed}</span>)

// Pass myTimer as a prop.
ReactDOM.render(<TimerView timer={myTimer} />, document.body)
```

<!--using global variables-->

Since it doesn't matter _how_ we got the reference to an observable, we can consume
observables from outer scopes directly (including from imports, etc.):

```javascript
const myTimer = new Timer() // See the Timer definition above.

// No props, `myTimer` is directly consumed from the closure.
const TimerView = observer(() => <span>Seconds passed: {myTimer.secondsPassed}</span>)

ReactDOM.render(<TimerView />, document.body)
```

Using observables directly works very well, but since this typically introduces module state, this pattern might complicate unit testing. Instead, we recommend using React Context instead.

<!--using React context-->

[React Context](https://reactjs.org/docs/context.html) is a great mechanism to share observables with an entire subtree:

```javascript
import {observer} from 'lobx-react'
import {createContext, useContext} from "react"

const TimerContext = createContext<Timer>()

const TimerView = observer(() => {
    // Grab the timer from the context.
    const timer = useContext(TimerContext) // See the Timer definition above.
    return (
        <span>Seconds passed: {timer.secondsPassed}</span>
    )
})

ReactDOM.render(
    <TimerContext.Provider value={new Timer()}>
        <TimerView />
    </TimerContext.Provider>,
    document.body
)
```

Note that we don't recommend ever replacing the `value` of a `Provider` with a different one. Using `lobx`, there should be no need for that, since the observable that is shared can be updated itself.

<!--END_DOCUSAURUS_CODE_TABS-->

#### Using local observable state in `observer` components

Since observables used by `observer` can come from anywhere, they can be local state as well.
Again, different options are available for us.

<!--DOCUSAURUS_CODE_TABS-->
<!--`useState` with observable class-->

The simplest way to use local observable state is to store a reference to an observable class with `useState`.
Note that, since we typically don't want to replace the reference, we totally ignore the updater function returned by `useState`:

```javascript
import { observer } from "lobx-react"
import { useState } from "react"

const TimerView = observer(() => {
    const [timer] = useState(() => new Timer()) // See the Timer definition above.
    return <span>Seconds passed: {timer.secondsPassed}</span>
})

ReactDOM.render(<TimerView />, document.body)
```

If you want to automatically update the timer like we did in the original example,
`useEffect` could be used in typical React fashion:

```javascript
useEffect(() => {
    const handle = setInterval(() => {
        timer.increaseTimer()
    }, 1000)
    return () => {
        clearInterval(handle)
    }
}, [timer])
```

<!--`useState` with local observable object-->

As stated before, instead of using classes, it is possible to directly create observable objects.
We can leverage [observable](observable-state.md#observable) for that:

```javascript
import { observer } from "lobx-react"
import { observable } from "lobx"
import { useState } from "react"

const TimerView = observer(() => {
    const [timer] = useState(() =>
        observable({
            secondsPassed: 0,
            increaseTimer() {
                this.secondsPassed++
            }
        })
    )
    return <span>Seconds passed: {timer.secondsPassed}</span>
})

ReactDOM.render(<TimerView />, document.body)
```

<!--`useObservable` hook-->

The combination `const [store] = useState(() => observable({ /* something */}))` is
quite common. To make this pattern simpler the `useObservable` hook is exposed from `lobx-react` package, making it possible to simplify the earlier example to:

```javascript
import { observer, useObservable } from "lobx-react"
import { useState } from "react"

const TimerView = observer(() => {
    const timer = useObservable(() => ({
        secondsPassed: 0,
        increaseTimer() {
            this.secondsPassed++
        }
    }))
    return <span>Seconds passed: {timer.secondsPassed}</span>
})

ReactDOM.render(<TimerView />, document.body)
```

<!--END_DOCUSAURUS_CODE_TABS-->

### Always read observables inside `observer` components

You might be wondering, when do I apply `observer`? The rule of thumb is: _apply `observer` to all components that read observable data_.

`observer` only enhances the component you are decorating, not the components called by it. So usually all your components should be wrapped by `observer`. Don't worry, this is not inefficient. On the contrary, more `observer` components make rendering more efficient as updates become more fine-grained.

#### Tip: Grab values from objects as late as possible

`observer` works best if you pass object references around as long as possible, and only read their properties inside the `observer` based components that are going to render them into the DOM / low-level components.
In other words, `observer` reacts to the fact that you 'dereference' a value from an object.

In the above example, the `TimerView` component would **not** react to future changes if it was defined
as follows, because the `.secondsPassed` is not read inside the `observer` component, but outside, and is hence _not_ tracked:

```javascript
const TimerView = observer(({ secondsPassed }) => <span>Seconds passed: {secondsPassed}</span>)

React.render(<TimerView secondsPassed={myTimer.secondsPassed} />, document.body)
```

Note that this is a different mindset from other libraries like `react-redux`, where it is a good practice to dereference early and pass primitives down, to better leverage memoization.

#### Don't pass observables into components that aren't `observer`

Components wrapped with `observer` _only_ subscribe to observables used during their _own_ rendering of the component. So if observable objects / arrays / maps are passed to child components, those have to be wrapped with `observer` as well.
This is also true for any callback based components.

If you want to pass observables to a component that isn't an `observer`, either because it is a third-party component, or because you want to keep that component `lobx` agnostic, you will have to use `forceObserve` before passing them on.

To elaborate on the above,
take the following example observable `todo` object, a `TodoView` component (observer) and an imaginary `GridRow` component that takes a column / value mapping, but which isn't an `observer`:

```javascript
class Todo extends Observable {
    title = "test"
    done = true
}

const TodoView = observer(({ todo }: { todo: Todo }) =>
   // WRONG: GridRow won't pick up changes in todo.title / todo.done
   //        since it isn't an observer.
   return <GridRow data={todo} />

   // CORRECT: let `TodoView` detect relevant changes in `todo`,
   //          and pass plain data down.
   return <GridRow data={{
       title: todo.title,
       done: todo.done
   }} />

   // CORRECT: using `toJS` works as well, but being explicit is typically better.
   return <GridRow data={toJS(todo)} />
)
```

#### Callback components might require `<Observer>`

Imagine the same example, where `GridRow` takes an `onRender` callback instead.
Since `onRender` is part of the rendering cycle of `GridRow`, rather than `TodoView`'s render (even though that is where it syntactically appears), we have to make sure that the callback component uses an `observer` component.
Or, we can create an in-line anonymous observer using `<Observer />`

```javascript
const TodoView = observer(({ todo }: { todo: Todo }) => {
    // WRONG: GridRow.onRender won't pick up changes in todo.title / todo.done
    //        since it isn't an observer.
    return <GridRow onRender={() => <td>{todo.title}</td>} />

    // CORRECT: wrap the callback rendering in Observer to be able to detect changes.
    return <GridRow onRender={() => <Observer>{() => <td>{todo.title}</td>}</Observer>} />
})
```

### Tips

<details id="static-rendering"><summary>Server Side Rendering (SSR)<a href="#static-rendering" class="tip-anchor"></a></summary>
If `observer` is used in server side rendering context; make sure to call `enableStaticRendering(true)`, so that `observer` won't subscribe to any observables used, and no GC problems are introduced.
</details>

<details id="observer-vs-memo"><summary>**Note:** `observer` or `React.memo`?<a href="#observer-vs-memo" class="tip-anchor"></a></summary>
`observer` automatically applies `memo`, so `observer` components never need to be wrapped in `memo`.
`memo` can be applied safely to observer components because mutations (deeply) inside the props will be picked up by `observer` anyway if relevant.
</details>

<details id="wrap-order"><summary>{🚀} **Tip:** when combining `observer` with other higher-order-components, apply `observer` first<a href="#wrap-order" class="tip-anchor"></a></summary>

When `observer` needs to be combined with other decorators or higher-order-components, make sure that `observer` is the innermost (first applied) decorator;
otherwise it might do nothing at all.

</details>

<details id="computed-props"><summary>{🚀} **Tip:** deriving computeds from props<a href="#computed-props" class="tip-anchor"></a></summary>
In some cases the computed values of your local observables might depend on some of the props your component receives.
However, the set of props that a React component receives is in itself not observable, so changes to the props won't be reflected in any computed values. You have to manually update local observable state in order to properly derive computed values from latest data.

```javascript
import { observer, useObservable } from "lobx-react"
import { useEffect } from "react"

const TimerView = observer(({ offset = 0 }) => {
    const timer = useObservable(() => ({
        offset, // The initial offset value
        secondsPassed: 0,
        increaseTimer() {
            this.secondsPassed++
        },
        get offsetTime() {
            return this.secondsPassed - this.offset // Not 'offset' from 'props'!
        }
    }))

    useEffect(() => {
        // Sync the offset from 'props' into the observable 'timer'
        timer.offset = offset
    }, [offset])

    // Effect to set up a timer, only for demo purposes.
    useEffect(() => {
        const handle = setInterval(timer.increaseTimer, 1000)
        return () => {
            clearInterval(handle)
        }
    }, [])

    return <span>Seconds passed: {timer.offsetTime}</span>
})

ReactDOM.render(<TimerView />, document.body)
```

In practice you will rarely need this pattern, since
`return <span>Seconds passed: {timer.secondsPassed - offset}</span>`
is a much simpler, albeit slightly less efficient solution.

</details>

<details id="useeffect"><summary>{🚀} **Tip:** useEffect and observables<a href="#useeffect" class="tip-anchor"></a></summary>

`useEffect` can be used to set up side effects that need to happen, and which are bound to the life-cycle of the React component.
Using `useEffect` requires specifying dependencies.
With `lobx` that isn't really needed, since `lobx` has already a way to automatically determine the dependencies of an effect, `autorun`.
Combining `autorun` and coupling it to the life-cycle of the component using `useEffect` is luckily straightforward:

```javascript
import { observer, useObservable } from "lobx-react"
import { useState } from "react"

const TimerView = observer(() => {
    const timer = useObservable(() => ({
        secondsPassed: 0,
        increaseTimer() {
            this.secondsPassed++
        }
    }))

    // Effect that triggers upon observable changes.
    useEffect(
        () =>
            autorun(() => {
                if (timer.secondsPassed > 60) alert("Still there. It's a minute already?!!")
            }),
        []
    )

    // Effect to set up a timer, only for demo purposes.
    useEffect(() => {
        const handle = setInterval(timer.increaseTimer, 1000)
        return () => {
            clearInterval(handle)
        }
    }, [])

    return <span>Seconds passed: {timer.secondsPassed}</span>
})

ReactDOM.render(<TimerView />, document.body)
```

Note that we return the disposer created by `autorun` from our effect function.
This is important, since it makes sure the `autorun` gets cleaned up once the component unmounts!

The dependency array can typically be left empty, unless a non-observable value should trigger a re-run of the autorun, in which case you will need to add it there.
To make your linter happy, you can define `timer` (in the above example) as a dependency.
That is safe and has no further effect, since the reference will never actually change.

If you'd rather explicitly define which observables should trigger the effect, use `reaction` instead of `autorun`, beyond that the pattern remains identical.

</details>



## Working with classes

While classes can't be observed directly, you can create observable classes that will return observable instances. Those classes can be then further configured to give fine grained control as to what properties are observable, which getters are computed and what methods are actions.

An observable class can be created by extending `Observable`

```javascript
import { Observable } from "lobx";

class Todos extends Observable {
	// observable
	todos = [];
	// observable
	filter = "";

	//computed
	get filteredTodos() {
		return this.todos.filter((todo) => todo.title.includes(this.filter));
	}

	//action
	createTodo(title) {
		this.todos.push(new Todo({ title }));
	}

	//action
	setFilter(filter) {
		this.filter = filter;
	}
}

class Todo extends Observable {
	// observable
	title = "";
	// observable
	completed = false;

	constructor({ title = "", completed = false } = {}) {
		super();
		this.title = title;
		this.completed = completed;
	}

	//action
	setTitle(title) {
		this.title = title;
	}

	//action
	setCompleted(completed) {
		this.completed = completed;
	}
}
```

By default any property of an `Observable` class will be `observable`, methods will be an `action` and getters will be `computed`.

Note: EcmaScript private fields (#field) can not be made observable.

## Configuring classes

If you need more fine grained control as to which properties are observable or which methods are actions you can use `decorate`.

Using the above example:

```javascript
import { decorate, computed, action, observable } from "lobx";

decorate(
	{
		filteredTodos: computed,
		todos: observable,
		filter: observable,
		createTodo: action,
		setFilter: action,
	},
	Todos
);

decorate(
	{
		title: observable,
		completed: observable,
		setTitle: action,
		setCompleted: action,
	},
	Todo
);
```

`decorate` can only be called once on any given `Observable`, it will return the passed in class. `decorate` will overwrite the default configuration.

## Decorator support

If preferred configuring `Observable` can also be done via decorators

```javascript
import { observable, computed, action, Observable } from "lobx";

class Todos extends Observable {
	@observable todos = [];
	@observable filter = "";

	@computed get filteredTodos() {
		return this.todos.filter((todo) => todo.title.includes(this.filter));
	}

	@action createTodo(title) {
		this.todos.push(new Todo(title));
	}

	@action setFilter(filter) {
		this.filter = filter;
	}
}
```

Much like with `decorate` the presence of a decorator on an `Observable` will overwrite the default configuration on that class.

## Extending Observable classes

You can also extend observable classes, when done the configuration of the base class will merge with the extending class.

## Async actions

Actions on `lobx` (and `mobx`) serve as unit of work and will prevent reactions from being triggered while an action is in progress. Ensuring that reactions are not triggered on intermediate state mutations. When it comes to async actions an extra step is required to ensure that operations happen after the first `await` are still wrapped in an action. To do this, everything to the right of an `await` needs to be wrapped with in a `task`

```javascript
import { observable, computed, action, Observable, task } from "lobx";

class Todos extends Observable {
	todos = [];
	filter = "";

	get filteredTodos() {
		return this.todos.filter((todo) => todo.title.includes(this.filter));
	}

	async fetchTodos() {
		// we're in an action
		this.todos = [];

		// wrap our async call in `task`
		const todoData = await task(fetchTodos());

		// this will continue to execute in an action because of our use of `task()` above
		todoData.forEach((todo) => this.todos.push(new Todo(todo)));
	}

	createTodo(title) {
		this.todos.push(new Todo(title));
	}

	setFilter(filter) {
		this.filter = filter;
	}
}
```

Always use `task` with `await`, and only use `task` in an `action`. Using it in any other way can result in unpredictable behavior. (This is because `task` will end the current action and resume it when the passed in promise is resolved)

## Enforcing actions

By default `lobx` does not enforce the use of actions and allows you to mutate observables directly. Use `enforceActions(true)` to have `lobx` throw an error if a mutation to an observable is ever done without an action. (observables that are not currently observed by a reaction are exempted for this rule).

```javascript
import { autorun, observable, enforceActions, runInAction } from "lobx";

enforceActions(true); // enforce actions in lobx

const todos = observable([{ title: "write docs", completed: false }]);
autorun(() => {
	console.log("all todos: ", JSON.stringify(todos));
});

try {
	// will throw because we're mutating an observable that's actively being observed outside of an action
	todos[0].completed = true;
} catch (e) {}

runInAction(() => {
	todos[0].completed = true;
	todos.push({ title: "write better docs", completed: false });
}); // will not throw as our mutations are being ran in action
```

## Scheduling reactions

For most applications you want to enforce actions in order to ensure that reactions do not get called during intermediate state updates and only get called once all mutations for any given action have been made. This is primarily an optimization in order to avoid doing work that may need to be re-done once the next mutation is made synchronously.

While using and enforcing strict actions is the recommended way to work with `lobx` it does add some complexity. In certain situations you can avoid actions all together without having to run reactions on intermediate state updates. This can be done using a scheduler.

A scheduler allows you to batch reactions and have them run sometime in the future. When exactly they will be called will depend on how you set up the scheduler. For example we can set up a scheduler to run on some `setTimeout` value, on a `requestAnimationFrame` or `requestIdleCallback`. This approach might be a good fit for a visualization, where it would only make sense to update the visualization once a frame instead of every mutation of which can occur multiple times per frame.

```javascript
import { observable, createScheduler } from "lobx";

// create a scheduler that flushes all reactions on `requestAnimationFrame`
const frameScheduler = createScheduler((fn) => requestAnimationFrame(fn));

const points = [
	{ x: 0, y: 0, color: "red" },
	{ x: 10, y: 10, color: "blue" },
];

frameScheduler.autorun(() => {
	// an example renderer that will draw some points on a canvas given the above data structure
	drawPointsOnCanvas(points);
});

// multiple mutations outside of an action
points.push({ x: 1, y: 1, color: "green" });
points[0].x++;
points[1].color = "purple";
// reaction to these mutations will not be called until `requestAnimationFrame` is triggered, and then they will only be called once
```

`createScheduler` accepts a scheduling function that will pass in a callback. The scheduling function will be called as soon as there is a reaction. It is up to the scheduling function to execute the callback at some point either immediately or sometime in the future. `lobx` will not call the scheduling function again until the callback has ben executed. Executing the callback flushes all pending reactions.

## Using custom graphs

All reactions in `lobx` run on a graph. Initially `lobx` creates a default graph on which all observables and reactions register to. In certain rare situations you may want to isolate observables to a different graph. Observables and reactions on different graphs will not be able to interact together.

```javascript
import { graph, observable, autorun } from "lobx";

// create a new graph
const g = graph();

// create an observable on our custom graph
const todos = observable([{ title: "write docs", completed: false }], {
	graph: g,
});

// autorun on our custom graph
autorun(
	() => {
		console.log("all todos on custom graph: ", JSON.stringify(todos));
	},
	{ graph: g }
);

// autorun on the default graph
autorun(() => {
	console.log("all todos on default graph: ", JSON.stringify(todos));
});

// the first autorun wil execute but not the second as its registered to a different graph than the observable.
todos[0].completed = true;
```

## API and Usage

_Note: `lobx` is not API compatible with `mobx`._

### `observable(obj, {equals?, graph? })`

Return an observable proxy for a given object. Can be a plain object, array, map, set, date, weakmap or weakset. Resulting proxy will be deeply observed.

#### Options:

- `equals` default: `(a, b) => a === b || (a !== a && b !== b)`. By default an observable is considered changed if it produces a new reference. A custom `equals` method can be provided if for example you need to compare by value. If `equals` returns false then observers further down the graph will not be re-evaluated.

### `observable.box(value, { equals?, graph? })`

Wrap single value with an observable context.
_`mobx` equivalent: `observable.box`_

#### Options:

- `equals` default: `(a, b) => a === b || (a !== a && b !== b)`. By default an observable is considered changed if it produces a new reference. A custom `equals` method can be provided if for example you need to compare by value. If `equals` returns false then observers further down the graph will not be re-evaluated.

#### Methods:

- `get()`: returns the current value
- `set(newValue)`: sets a new value
- `equals(value): boolean`: uses the passed in comparator to determine if a value is equal to the current observable value.

### `observable.configure(config, value, {equals?, graph?})`

Creates an observable with a specific configuration, overwriting the default behavior which assigns properties as `observables`, getters as `computed` and methods and setters as `actions`. 

### `observable.opts({ref?})`

When decorating or using `observable.configure`, `observable.opts` allows for the customization of the observable field.

#### Options:

- `ref` (boolean) default `false`. If `ref` is true the observable property will not itself be deeply observed.


`observable` can also be used in `observable.configure` and `decorate` to denote an object/class property as an observable value.
### `computed(fn, { keepAlive = false, equals?, graph?, context? })`

Derive a new value from observables

```javascript
import { observable, computed } from "lobx";

const firstName = observable.box("Alice");
const lastName = observable.box("Smith");
const fullName = computed(() => `${firstName.get()} ${lastName.get()}`);
console.log(fullName.get()); // Alice Smith
```

#### Options:

- `keepAlive` default: `false`. If `true` will not clear out the computed value once the computed is no longer observed
- `equals` default: `(a, b) => a === b || (a !== a && b !== b)`. By default a computed is considered changed if it produces a new reference. A custom `equals` method can be provided if for example you need to compare by value. If `equals` returns false then observers further down the graph will not be re-evaluated.
- `context` what `this` will be when the computed method executes

#### Methods:

- `get()`: derive (if needed) a value and return it
- `equals(value): boolean`: uses the passed in comparator to determine if a value is equal to the current computed value. Might derive.
- `isDirty(): boolean`: returns `true` if computed needs to derive a value, `false` if it has already derived and cached one.
- `isKeepAlive(): boolean`: returns `true` if the computed is `keepAlive`, `false` otherwise.
- `setKeepAlive(keepAlive: boolean)`: change `keepAlive` , if the computed was `keepAlive` and is no longer observed will clear out the cached value.

### `computed.opts({keepAlive = false, equals?})`

When decorating or using `observable.configure`, `computed.opts` allows for the customization of the observable field.


`computed` can also be used in `observable.configure` and `decorate` to denote an object/class getter as a derived value.
### `action(fn, { graph? })`

An action allows you to mutate multiple observables and hold off reactions until the (outer most) action has completed. This prevents reactions of triggering on intermediate observable values.

### `action.opts({untracked = true, bound = false})`

When decorating or using `observable.configure`, `computed.opts` allows for the customization of a method or setter.

`untracked` is defaulted to `true` but can be set to `false` so that the observables accessed in a reaction within the action can still be tracked. Useful if you don't know ahead of time if the action will perform a mutation or just derive values based on parameters.

`bound` is defaulted to `false` but can be set to `true` if you wish to have the action's context to be automatically bound to the observable.

```javascript
import { observableObject, autorun, action } from "lobx";

const firstName = observable.box("Alice");
const lastName = observable.box("Smith");
const fullName = computed(() => `${firstName.get()} ${lastName.get()}`);

autorun(() => console.log(fullName.get())); //Alice Smith

const changeName = action(() => {
	firstName.set("Bob");
	lastName.set("Jones");
});

//execute the action
changeName(); // Bob Jones
```

`action` can also be used in `observable.configure` and `decorate` to denote an object/class method as an action.

### `Observable`

A base class which will need to be extended when using observables on a class. More details [here](#working-with-classes)

### `autorun(callback, { graph? })`

Perform a side effect each time from when an observable value changes. Runs immediately.

```javascript
import { observable, computed, autorun } from "lobx";

const firstName = observable.box("Alice");
const lastName = observable.box("Smith");
const fullName = computed(() => `${firstName.get()} ${lastName.get()}`);
const unsub = autorun(() => console.log(fullName())); //Alice Smith
firstName.set("Bob"); // Bob Smith
unsub(); // unsubscribes from future updates
```

### `reaction(tracker, callback, { graph? })`

Similar to `autorun` but splits the observation and effect into separate functions. Observation runs immediately whereas effect runs on change. The observation callback expects a returned value which will then be passed into the effect callback. If the value has not changed since the last run then the effect callback will not be invoked.

```javascript
import { observable, computed, reaction } from "lobx";

const firstName = observable.box("Alice");
const lastName = observable.box("Smith");
const fullName = computed(() => `${firstName.get()} ${lastName.get()}`);
const unsub = reaction(
	() => fullName.get(),
	(name) => console.log(name)
);
firstName.set("Bob"); // Bob Smith
lastName.set("Jones"); // Bob Jones
unsub(); // unsubscribes from future updates
```

### `runInAction(fn, { graph? })`

Just like `action` but instead of returning a function that can be later executed it will immediately execute the function passed in.

```javascript
import { observableObject, autorun, runInAction } from "lobx";

const firstName = observable.box("Alice");
const lastName = observable.box("Smith");
const fullName = computed(() => `${firstName.get()} ${lastName.get()}`);

autorun(() => console.log(fullName.get())); //Alice Smith

runInAction(() => {
	firstName.set("Bob");
	lastName.set("Jones");
}); // Bob Jones
```

### `batch(fn, {graph?})`

Batches a function so that any mutation performed within does not result in an intermediate reaction update. Reactions will only be called once the batch has been completed. Similar to `runInAction` but does not create an explicit action.

### `createScheduler(scheduler, {graph?})`

Creates a scheduler which gives complete control as to when reactions will be flushed.
More info can found [here](#scheduling-reactions)

#### Methods

- `listener(callback)` - Creates a scheduled `listener`
- `reaction(track, callback)` - Creates a scheduled `reaction`
- `autorun(callback)` - Creates a scheduled `autorun`

### `decorate(configuration, Class)`

Allows you to customize an `Observable` class with a given configuration. Can only be called once per unique class. More info can be found [here](#configuring-classes) 

### `atom({ graph? })`

A `atom` is a generic observable that enables the creation of custom observable types. It only has two methods; `reportChanged` and `reportObserved`. These methods are used to inform `lobx` as to when your observable has been read or written to.

_`mobx` equivalent: `createAtom`_

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

_`mobx` equivalent: `Reaction`_

```javascript
import { observable, listener } from "lobx";

const firstName = observable.box("Alice");
const lastName = observable.box("Smith");
const l = listener(() => console.log("observable changed!"));
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
- `isDisposed`: (boolean) has this listener been disposed

### `getObservableSource(observable)`

Given an observable proxy return the non-observable plain javascript source object.

### `untracked(fn, { graph? })`

Run a function without establishing observers.

### `isInAction()`

Returns a `boolean` as to whether or not we're currently within an action

### `isInBatch()`

Returns a `boolean` as to whether or not we're currently within an action or batch

### `isTracking()`

Returns a `boolean` as to whether or not we're currently in a derivation (`computed`, `autorun`, `reaction`, `listener`)

### `isObserved(observable | computed | atom, { graph? })`

Returns a `boolean` as to whether or not an observable node is currently being observed in a derivation

### `isObservable(object, {graph?})`

Returns a `boolean` as to whether or not the passed in object is a `lobx` observable

### `enforceActions(actionsEnforced)`

Pass in `true` to `enforceActions` to require

### `task(promise)`

When performing asynchronous actions everything to the right of an await needs to be wrapped in a `task` so that `lobx` knows to start a new action once the async operation has completed. More information can be found [here](#async-actions)

### `[Advanced] onReactionsComplete(callback)`

Called when all the reactions have ran on the graph

### `[Advanced] onObservedStateChange(callback, [key], callback)`

Allows you to get notified when an observable object or property on an object is being observed by a reaction or is no longer observed by reactions. The callback will be executed with a single parameter `observing` which is a boolean state to indicate if that object is being observed or not.

### `[Advanced] graph()`

A graph orchestrates all observable actions and reactions. Observables and derivations are all nodes on this graph. By default `lobx` will automatically create a graph which will be used for all nodes unless otherwise provided within the options. Creating a new graph and adding nodes to it, isolates those nodes from those added to the default graph or other graphs.

_`mobx` equivalent: `isolateGlobalState`_

```javascript
import { graph, observable, listener } from "lobx";

const newGraph = graph();
const o = observable.box(0, { graph: newGraph });
autorun(() => o.get());
o.set(o.get() + 1); // will not react as the listener node created by autorun and the observable live on different graphs
autorun(() => o.get(), { graph: newGraph });
o.set(o.get() + 1); // listener created above will react as both the listener and observable node were created on the same graph
```

#### Methods

`enforceActions(enforce)`

`isInAction()`

`isInBatch()`

`isObserved(node: ObservableNode)`

`isTracking()`

`runInAction(fn)`

`batch(fn)`

`onReactionsComplete(callback)`

`task(promise)`

`untracked(fn)`

### `[Advanced] getDefaultGraph()`

Returns the default graph created by `lobx`.

### `[Advanced] observe(obj, callback)`

The `observe` api allows you to hook into observable events and give you the opportunity to make mutations or perform additional actions before any reaction is triggered upon a change in an observable state. Typically only used if you're building a library on top of `lobx`.

The callback will be executed with one of these events, depending on the type of the observable passed in and the mutation performed.

```typescript
export type AddEvent<T> = {
	object: object;
	type: "add";
	name?: unknown;
	newValue: T;
};

export type DeleteEvent<T> = {
	object: object;
	type: "delete";
	name?: unknown;
	oldValue: T;
};

export type UpdateEvent<T> = {
	object: object;
	type: "update";
	name: unknown;
	oldValue: T;
	newValue: T;
};

// array only
export type UpdateArrayEvent<T> = {
	object: T[];
	type: "updateArray";
	index: number;
	oldValue: T;
	newValue: T;
};

// array only
export type SpliceArrayEvent<T> = {
	object: T[];
	type: "spliceArray";
	index: number;
	added: T[];
	removed: T[];
};
```




# Thanks

To the contributors of `mobx` and surrounding libraries for their amazing work.
