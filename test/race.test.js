const { Saga } = require('../src');
const { delay, race, forever } = require('../src/effects');
const { expect } = require('chai');
const sinon = require('sinon');

describe('race', () => {
  it('races two sagas', async () => {
    const done1 = sinon.spy();
    const done2 = sinon.spy();
    function* child1() {
      yield delay(10);
      done1();
      return 'one';
    }
    function* child2() {
      yield delay(20);
      done2();
      return 'two';
    }
    function* gen() {
      return yield race(child1(), child2());
    }
    const saga = new Saga(gen());
    const result = await saga.promise;
    expect(done1).to.have.been.called;
    expect(done2).not.to.have.been.called;
    expect(result).to.equal('one');
  });

  it('cancel affects raced sagas', async () => {
    const done = sinon.spy();
    function* child() {
      yield forever();
      done();
    }
    function* gen() {
      return yield race(child());
    }
    const saga = new Saga(gen());
    await delay(5);
    saga.cancel();
    expect(done).not.to.have.been.called;
  });
});
