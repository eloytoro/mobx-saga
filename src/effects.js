import effect from './effect'

export const delay = (ms, val) => new Promise(resolve => setTimeout(() => resolve(val), ms))

export const forever = effect(
  () => {},
  (saga) => saga.promise
)

export const cancel = effect(
  (saga) => saga,
  (saga, child) => child.cancel()
)

export const fork = effect(
  (iterable) => iterable,
  (saga, iterable) => {
    const child = saga.spawn(iterable);
    child.promise.catch(err => saga.reject(err));
    return child;
  }
)

export const race = effect(
  (...inputs) => inputs,
  (saga, inputs) => {
    const children = inputs.map(input => saga.spawn(input));
    return Promise.race(children.map(child => {
      return child.promise.then(result => {
        children.forEach(child => child.cancel());
        return result;
      });
    }));
  }
)

export const teardown = effect(
  (input, fn) => ({ input, fn }),
  (saga, { input, fn }) => {
    const unsub = saga.listen('cancel', () => fn(input));
    return saga.next(input).then(result => {
      unsub();
      return result;
    });
  }
)
