import Saga from './internal/Saga';
import { defer } from './internal/utils';
import { reaction, observable } from 'mobx';

const identity = val => val;

export const reduce = (initialValue, select) => {
  return (target, prop, currentDescriptor) => {
    if (target.constructor !== Object) {
      throw new TypeError('[MobXSaga] Decorating classes is not supported');
    }
    const generator = target[prop].bind(target);

    const value = observable.box(initialValue);
    const update = value.set.bind(value);
    reaction(select.bind(null, target), (value) => generator(value).then(update));
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

export const every = (generator) => {
  return function (...params) {
    return Saga.immediate(generator.apply(this, params));
  }
};

export const latest = (generator) => {
  let currentSaga;
  let deferred;
  return function (...params) {
    if (currentSaga) {
      currentSaga.cancel();
    } else {
      deferred = defer();
    }
    currentSaga = new Saga(generator.apply(this, params));
    currentSaga.promise
      .then(result => {
        deferred.resolve(result);
        currentSaga = null;
      })
      .catch(err => {
        deferred.reject(err);
        currentSaga = null;
      });
    return deferred.promise;
  };
};

export const channel = (generator) => {
  const queue = [];
  return function (...params) {
    const before = queue.slice();
    const promise = Promise.all(queue.slice())
      .then(() => Saga.immediate(generator.apply(this, params)))
    queue.push(promise);
    return promise.then(value => {
      queue.shift();
      return value;
    });
  };
};
