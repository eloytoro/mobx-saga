# mobx-saga

This library serves as an extension for the `flow` logic that mobx provides, adding some key
features:

* Asynchronous logic for computed values.
* Cancelling ongoing logic for async computed values & actions.
* Useful effects to spawn and kill "sub-processes".

## Use case

Declare your sagas in your observable and then use the `decorate` function from mobx to specify
the logic you want to apply.

```js
const user = observable({
  channel: null,
  messages: function* (channel) {
    const messages = yield getMessagesFromChannel(channel);
    return messages;
  }
})

decorate(user, {
  messages: latest([], () => user.channel)
})
```

This will make it so every change to the `user.channel` property will trigger
`getMessagesFromChannel` async request, which then overwrite the `messages` property, now modifying
properties triggers async flows!

## API

### Decorators

Use these to `decorate` your properties in observable objects, you have to define an initial value
so it can be initialized and a `trackingFn` that acts as a mobx `reaction`, the result of this
function will be observed, and its value will passed to the generator every time it changes.

* `every(initialValue, trackingFn)`: will create a new instance of each saga every time it triggers
* `latest(initialValue, trackingFn)`: will cancel previous running instances every time it triggers
* `channel(initialValue, trackingFn)`: will queue new instances every time it triggers

You can also define saga actions the same way you would define `flow` using the decorators.

### Effects

#### `yield <expression>`

Within sagas you can yield many kinds of sagaable expressions, depending on the type of the
expression the saga will handle it differently:

* Iterables: the saga will start iterating over the given iterable.
* Promises: the saga will wait for the promise to resolve or reject.
* Arrays: the saga will handle every item of the array at the same time, useful for concurrency.

#### `yield fork(input: Iterable): Saga`

Creates a new non-blocking saga from the given input and appends it to the saga that spawns
it. Useful when you need to keep track of child saga execution.

#### `yield race(...inputs: Iterable): Promise`

Creates a saga for each different input and races them, the first one to finish will return and
cancels the rest.

#### `yield delay(ms: number, [val]): Promise`

A promise that resolves after the given ms, if `val` is specified, it will resolve to that value.

#### `#yield cancel(saga: Saga)`

Cancels the given saga, same as `saga.cancel()`.

#### `yield forever()`

Hangs the saga forever.

#### `yield teardown(input: Iterable, handler: Function): Promise`

Allows you to define custom cancellation logic for your blocking calls. When your saga is
cancelled the cancellation propagates to all of its children but this doesn't prevent external
logic from cancelling as well. This effect allows you to "subscribe" to the cancellation event and
fire up the `handler` when it happens, this is useful to tell external logic that the saga is no
longer paying attention to its result and that it may stop what its doing.

Example:

```js
// `request` adds an `.abort` method to its returned promise
function* upload() {
  const result = yield teardown(
    // this value is "thenable" and blocks the saga
    request(url, file),
    // will called if this saga is cancelled at any time
    req => req.abort()
  )
  // if the saga is cancelled at this point the `.abort` method
  // wont be called
  return result
}
```

## Advanced API

### `new Saga(input: Iterable)`

Creates a new saga from the given `input` and starts running it immediately. The `ctx` is an
object that can be accessed by the saga and by all child sagas of itself as well.

* `Saga.prototype.promise: Promise`: a promise that resolves when the saga (and all its children)
finishes succesfully (no errors emitted), it will resolve if the saga is cancelled, but with no
result value.
* `Saga.prototype.cancel()`: cancels the saga (and all of its children).
* `Saga.prototype.spawn(input)`: creates a child saga from the input
* `Saga.prototype.free()`: cancel all the child sagas
* `Saga.prototype.running: Boolean`: is the saga still running.
* `Saga.prototype.cancelled: Boolean`: was the saga cancelled.
* `Saga.prototype.resolved: Boolean`: was the saga resolved.
* `Saga.prototype.rejected: Boolean`: was the saga rejected.
* `Saga.immedate(input: Iterable): Promise`: shorthand for creating a new saga and return the
promise.

### `effect(payloadCreator, handler): (...args) => effect`

Allows you to define your own effects

* `payloadCreator: (...args)`: A function that will transform `...args` passed to the effect into a
single payload, you should define your effect's function signature using this function.
* `handler: (saga: Saga, payload: any)`: The handler function will be invoked when the effect is
yielded by a saga, the `saga` is the saga yielding the effect and the `payload` is the
result of calling `payloadCreator` with the arguments passed to the effect when yielded. The handler
can return a promise as well.

Example:

```js
const race = effect(
  // payloadCreator: concats all parameters into an array
  (...inputs) => inputs,
  // handler: invoked with the result of the payloadCreator
  (saga, inputs) => {
    const children = inputs.map(item => saga.spawn(item));
    return Promise.race(children.map(child => child.promise))
      .then(result => {
        children.forEach(child => child.cancel());
        return result;
      });
  }
);
```

## Importing/requiring

```js
import { Saga, latest, fork, delay } from 'mobx-saga'
```

## Concepts

### Child sagas

Sagas can have child sagas, these will affect how your saga behaves. They can be created
by effects such as `fork`, `race` or `latest`.

The following rules apply:

* When a child saga throws, so will the parent.
* When a parent saga cancels it will also cancel all of its children.
* When a parent saga finishes, it wont be resolved until all of its children finish as well.
* Cancelling a saga means it will never resolve or reject.

### Error handling

Sagas can throw errors as well as handle them, for most use cases the handling of errors should
be exactly like async/await functions do. However if a child saga throws an error to its parent
there's no try/catch to stop it, make sure to catch errors within the saga, otherwise they would
just propagate indefinetly.

## Examples

### Concurrent sagas

Wait for an amount of sagas to complete

```js
function* main() {
  try {
    // resolves when the 3 are done
    const [user, news, notifications] = yield [
      getUser(),
      getNewsfeed(),
      getNotifications()
    ]
  } catch (err) {
    // if any of the 3 above emit an error will be handled here
  }
}
```

### Forking sagas

```js
function* pollNewsfeed() {
  while (true) {
    const news = yield getNewsfeed()
    // ...
    yield delay(1000)
  }
}

function* main() {
  // start non-blocking saga
  const saga = yield fork(pollNewsfeed())
  yield delay(8000)
  // cancel the saga after 8 seconds
  yield cancel(saga)
}
```
