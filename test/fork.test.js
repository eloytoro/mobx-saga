const { Saga } = require('../src');
const { delay, fork, forever } = require('../src/effects');
const { expect } = require('chai');
const sinon = require('sinon');

describe('fork', () => {
  it('forks a saga', async () => {
    let count = 0;
    const now = Date.now();
    const done = sinon.spy();
    function* child(ms) {
      yield delay(ms);
      count = count + 1;
      return count;
    }
    function* gen() {
      const resultArray = yield [fork(child(15)), fork(child(15)), child(0)];
      const saga = yield fork(child(15));
      done(resultArray, saga);
    }
    const saga = new Saga(gen());
    expect(done).not.to.have.been.called;
    expect(saga.running).to.equal(true);
    await delay(5);
    expect(done).to.have.been.called;
    expect(saga.running).to.equal(false);
    await delay(20);
    const resultArray = done.args[0][0];
    expect(resultArray).to.have.length(3);
    expect(resultArray[0]).to.be.instanceof(Saga);
    expect(resultArray[1]).to.be.instanceof(Saga);
    expect(resultArray[2]).to.equal(1);
    expect(count).to.equal(4);
  });

  it('waits for child sagas', async () => {
    const now = Date.now();
    function* child(ms) {
      yield delay(ms);
    }
    function* gen() {
      yield [fork(child(20)), fork(child(10))];
    }
    const saga = new Saga(gen());
    await saga.promise;
    expect(Date.now() - now).to.be.gt(10);
  });

  it('cancels forks', async () => {
    const now = Date.now();
    function* child() {
      yield forever();
    }
    function* gen() {
      const saga = yield fork(child());
      yield delay(10);
      saga.cancel();
    }
    const saga = new Saga(gen());
    await saga.promise;
    expect(Date.now() - now).to.be.lt(20);
  });

  it('propagates error to parent', async () => {
    const err = new Error();
    const done = sinon.spy();
    const kill = sinon.spy(() => {
      throw err;
    });
    function* child(ms) {
      yield delay(ms);
      kill();
    }
    function* gen() {
      const saga = yield fork(child(20));
      yield delay(30);
      done();
    }
    const saga = new Saga(gen());
    await expect(saga.promise).to.be.rejectedWith(err);
    expect(done).to.not.have.been.called;
    expect(kill).to.have.been.called;
  });
});
