const { delay } = require('../src/effects');
const { expect } = require('chai');
const sinon = require('sinon');
const { latest, channel, every } = require('../src/decorators');
const { decorate, observable, computed, autorun } = require('mobx');

describe('decorators', () => {
  it('decorated properties cant be assigned', () => {
    const obs = observable({
      foo: 0,
      bar: function*(val) {
        return val;
      },
    });

    const store = decorate(obs, {
      bar: latest(null, () => obs.foo),
    });

    expect(() => {
      store.bar = 3;
    }).to.throw;
  });

  it('decorated properties can be observed', async () => {
    const obs = observable({
      foo: 0,
      bar: function*(val) {
        return val + 1;
      },
      get baz() {
        return this.bar + 1;
      },
    });

    const store = decorate(obs, {
      bar: latest(0, () => obs.foo),
    });

    store.foo = 1;
    expect(store.bar).to.equal(0);
    expect(store.baz).to.equal(1);
    await delay(0);
    expect(store.bar).to.equal(2);
    expect(store.baz).to.equal(3);
  });

  describe('latest', async () => {
    it('cancels previous calls', async () => {
      const start = sinon.spy();
      const end = sinon.spy();
      const obs = observable({
        foo: 0,
        bar: function*(val) {
          start();
          yield delay(20);
          end();
          return val + 3;
        },
      });

      const store = decorate(obs, {
        bar: latest(null, () => obs.foo),
      });

      expect(store.bar).to.equal(null);
      store.foo = 3;
      await delay(10);
      store.foo = 4;
      await delay(30);
      expect(store.bar).to.equal(7);
      expect(start).to.have.been.calledTwice;
      expect(end).to.have.been.calledOnce;
    });

    it('as flow', async () => {
      const obs = observable({
        last: latest(function*(count) {
          yield delay(40);
          return count;
        }),
      });

      const spy = sinon.spy();
      obs.last(1).then(spy);
      await delay(20);
      obs.last(2).then(spy);
      await obs.last(3).then(spy);
      expect(spy.args).to.deep.equal([[3], [3], [3]]);
    });
  });

  describe('channel', () => {
    it('queues the task after the last one', async () => {
      const obs = observable({
        count: 0,
        throttled: function*(count) {
          yield delay(40);
          return count + 1;
        },
      });

      const store = decorate(obs, {
        throttled: channel(0, () => obs.count),
      });

      store.count = 1;
      store.count = 13;
      store.count = 24;
      expect(store.throttled).to.equal(0);
      await delay(60);
      expect(store.throttled).to.equal(2);
      await delay(40);
      expect(store.throttled).to.equal(14);
      await delay(40);
      expect(store.throttled).to.equal(25);
    });

    it('as flow', async () => {
      const obs = observable({
        throttled: channel(function*(count) {
          yield delay(40);
          return count + 1;
        }),
      });

      let resolved;
      obs.throttled(1).then(c => (resolved = c));
      obs.throttled(13).then(c => (resolved = c));
      obs.throttled(24).then(c => (resolved = c));
      await delay(60);
      expect(resolved).to.equal(2);
      await delay(40);
      expect(resolved).to.equal(14);
      await delay(40);
      expect(resolved).to.equal(25);
    });
  });

  describe('every', () => {
    it('creates a new saga for each call', async () => {
      const obs = observable({
        count: 0,
        delayed: function*(count) {
          yield delay(20);
          return count + 1;
        },
      });

      const store = decorate(obs, {
        delayed: every(0, () => obs.count),
      });

      expect(store.delayed).to.equal(0);
      store.count = 1;
      await delay(15);
      store.count = 13;
      await delay(15);
      expect(store.delayed).to.equal(2);
      store.count = 24;
      await delay(10);
      expect(store.delayed).to.equal(14);
      await delay(30);
      expect(store.delayed).to.equal(25);
    });

    it('as flow', async () => {
      const foobar = sinon.spy();
      const spybaz = sinon.spy();
      const obs = observable({
        foo: 0,
        bar: 1,
        baz: 2,
        mySaga: every(function*(val) {
          this.foo += val;
          this.bar -= val;
          yield delay(20);
          this.baz -= val;
          this.baz -= val;
        }),
      });

      autorun(() => {
        foobar(obs.foo, obs.bar);
      });

      autorun(() => {
        spybaz(obs.baz);
      });

      await obs.mySaga(1);
      expect(foobar).to.have.been.calledTwice;
      expect(foobar.args[0]).to.deep.equal([0, 1]);
      expect(foobar.args[1]).to.deep.equal([1, 0]);

      expect(spybaz).to.have.been.calledTwice;
      expect(spybaz.args[0]).to.deep.equal([2]);
      expect(spybaz.args[1]).to.deep.equal([0]);
    });
  });
});
