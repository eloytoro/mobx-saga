const { Saga } = require('../src');
const { delay, forever } = require('../src/effects');
const { expect } = require('chai');
const sinon = require('sinon');

describe('Saga', () => {
  it('returns the final value', async () => {
    function* greet() {
      return 'greetings';
    }
    const result = await Saga.immediate(greet());
    expect(result).to.equal('greetings');
  });

  it('manages concurrency', async () => {
    let flag = false;
    const done = sinon.spy();
    const assertFlag = sinon.spy(val => expect(flag).to.equal(val));
    const gen1 = sinon.spy(function*() {
      yield delay(10);
      assertFlag(false);
      flag = true;
    });
    const gen2 = sinon.spy(function*() {
      yield delay(5);
      assertFlag(false);
      yield delay(10);
      assertFlag(true);
    });
    function* gen() {
      yield [gen1(), gen2()];
      done();
    }
    await Saga.immediate(gen());
    expect(done).to.have.been.called;
    expect(gen1).to.have.been.called;
    expect(gen2).to.have.been.called;
    expect(assertFlag).to.have.callCount(3);
  });

  it('resolves all primitive values', async () => {
    function* gen() {
      const num = yield 1;
      const str = yield 'two';
      const bool = yield true;
      const arr = yield [1, 'two', true];
      const obj = yield { foo: 'bar' };
      return [num, str, bool, arr, obj];
    }

    const [num, str, bool, arr, obj] = await Saga.immediate(gen());
    expect(num).to.equal(1);
    expect(str).to.equal('two');
    expect(bool).to.equal(true);
    expect(arr).to.eql([1, 'two', true]);
    expect(obj).to.eql({ foo: 'bar' });
  });

  it('cancels', async () => {
    const step1 = sinon.spy();
    const step2 = sinon.spy();
    function* cancellable() {
      step1();
      yield delay(10);
      step2();
    }
    const saga = new Saga(cancellable());
    await delay(5);
    saga.cancel();
    await delay(10);
    expect(step1).to.have.been.called;
    expect(step2).not.to.have.been.called;
  });

  it('cancels child sagas', async () => {
    const done1 = sinon.spy();
    const done2 = sinon.spy();
    const done3 = sinon.spy();
    function* child1() {
      yield delay(10);
      done1();
    }
    function* child2() {
      yield delay(20);
      done2();
    }
    function* child3() {
      yield delay(30);
      done3();
    }
    function* gen() {
      yield [child1(), child2(), child3()];
    }
    const saga = new Saga(gen());
    await delay(15);
    saga.cancel();
    await delay(20);
    expect(done1).to.have.been.called;
    expect(done2).not.to.have.been.called;
    expect(done3).not.to.have.been.called;
  });

  it("cancel doesn't resolve or reject the saga", async () => {
    let flag = false;
    function* gen() {
      yield delay(100);
    }
    const saga = new Saga(gen());
    saga.promise.then(() => (flag = true)).catch(() => (flag = true));
    expect(flag).to.equal(false);
    saga.cancel();
    await delay(0);
    expect(flag).to.equal(false);
  });

  it('throws errors', async () => {
    const err = new Error();
    function* gen() {
      throw err;
    }
    await expect(Saga.immediate(gen())).eventually.to.be.rejectedWith(err);
  });

  it('handles errors', async () => {
    const err = new Error();
    const handle = sinon.spy();
    function* gen() {
      yield Promise.reject(err);
    }
    await expect(Saga.immediate(gen())).eventually.to.be.rejectedWith(err);
  });

  it('propagates errors', async () => {
    const err = new Error();
    function* delayErr() {
      yield delay(20);
      throw err;
    }
    function* gen() {
      yield delayErr();
    }
    await expect(Saga.immediate(gen())).eventually.to.be.rejectedWith(err);
  });
});
