import Effect from './Effect';
import { defer, isIterable } from './utils';
import { action } from 'mobx';

class Saga {
  static immediate(input) {
    const saga = new Saga(input);
    return saga.promise;
  }

  constructor(input) {
    this.status = 'running';
    this.children = [];
    this.deferred = defer();
    this.listeners = {
      end: [],
      cancel: [],
    };
    Promise.resolve(this.next(input))
      .then(result => {
        this.resolve(result);
      })
      .catch(err => {
        this.reject(err);
      });
  }

  get promise() {
    return this.deferred.promise;
  }
  get running() {
    return this.status === 'running';
  }
  get cancelled() {
    return this.status === 'cancelled';
  }
  get resolved() {
    return this.status === 'resolved';
  }
  get rejected() {
    return this.status === 'rejected';
  }

  async next(input) {
    if (input === null) {
      return input;
    } else if (input instanceof Saga) {
      return input.promise;
    } else if (input instanceof Effect) {
      return input.handler(this, input.payload);
    } else if (isIterable(input)) {
      return this.iterate(input);
    } else if (Array.isArray(input)) {
      return Promise.all(input.map(item => this.next(item)));
    } else if (typeof input === 'function') {
      return this.next(input());
    }
    return input;
  }

  async iterate(iterable, step = action(iterable.next).call(iterable)) {
    try {
      const result = await this.next(step.value);
      if (step.done || !this.running) return result;
      return this.iterate(
        iterable,
        action(iterable.next).call(iterable, result),
      );
    } catch (err) {
      if (step.done || !this.running) throw err;
      return this.iterate(
        iterable,
        action(iterable.throw).call(iterable, err)
      );
    }
  }

  free() {
    this.children.forEach(child => child.cancel());
  }

  spawn(input) {
    const child = new Saga(input);
    this.children.push(child);
    child.listen('end', () => {
      this.children.splice(this.children.indexOf(child), 1);
      if (!this.running && !this.cancelled) {
        this.end();
      }
    });
    return child;
  }

  end() {
    if (this.children.length > 0) return;
    if (this.resolved) {
      this.deferred.resolve(this.result);
    } else if (this.rejected) {
      this.deferred.reject(this.error);
    }
    this.trigger('end');
  }

  cancel() {
    if (!this.running) return;
    this.status = 'cancelled';
    this.free();
    this.trigger('cancel');
    this.end();
  }

  resolve(value) {
    if (!this.running) return;
    this.status = 'resolved';
    this.result = value;
    this.end();
  }

  reject(err) {
    if (!this.running) return;
    this.status = 'rejected';
    this.error = err;
    this.free();
    this.end();
  }

  trigger(event, ...args) {
    this.listeners[event].forEach(listener => listener(...args));
  }

  listen(event, listener) {
    if (typeof listener !== 'function') return;
    const listeners = this.listeners[event];
    if (!listeners) {
      throw new Error(`Saga#listen(${event}) is not a valid event`);
    }
    listeners.push(listener);
    return () => listeners.splice(listeners.indexOf(listener), 1);
  }
}

export default Saga;
