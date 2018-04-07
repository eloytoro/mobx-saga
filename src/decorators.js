import Saga from './internal/Saga';
import { defer } from './internal/utils';
import { reaction, observable } from 'mobx';

const identity = val => val;

const decorator = (main) => (initialValue, select) => {
  if (typeof initialValue === 'function') {
    const generator = initialValue;
    return main(generator, identity);
  }
  return (target, prop, currentDescriptor) => {
    if (target.constructor !== Object) {
      throw new TypeError('[MobXSaga] Decorating classes is not supported');
    }
    const generator = target[prop].bind(target);

    const value = observable.box(initialValue);
    const update = value.set.bind(value);
    reaction(select.bind(null, target), main(generator, update, target));
    return {
      get() {
        return value.get();
      },
      set() {
        throw new TypeError('[MobXSaga] Modifying decorated values is not supported');
      }
    };
  };
};

export const every = decorator((generator, update) => {
  return function (computed) {
    return Saga.immediate(generator.call(this, computed)).then(update);
  }
});

export const latest = decorator((generator, update) => {
  let currentSaga;
  let deferred;
  return function (computed) {
    if (currentSaga) {
      currentSaga.cancel();
    } else {
      deferred = defer();
    }
    currentSaga = new Saga(generator.call(this, computed));
    currentSaga.promise
      .then(result => {
        deferred.resolve(result);
        currentSaga = null;
      })
      .catch(err => {
        deferred.reject(err);
        currentSaga = null;
      });
    return deferred.promise.then(update);
  };
});

export const channel = decorator((generator, update) => {
  const queue = [];
  return function (computed) {
    const before = queue.slice();
    const promise = Promise.all(queue.slice())
      .then(() => Saga.immediate(generator.call(this, computed)))
    queue.push(promise);
    return promise.then(value => {
      queue.shift();
      return update(value);
    });
  };
});
