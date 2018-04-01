const { Saga } = require('../src');
const { teardown, delay, forever } = require('../src/effects');
const { expect } = require('chai');
const sinon = require('sinon');

describe('teardown', () => {
  it('execs teardown logic', async () => {
    const handler = sinon.spy();
    const never = sinon.spy();
    function* gen() {
      yield teardown(forever(), handler);
      never();
    }
    const saga = new Saga(gen());
    await delay(5);
    saga.cancel();
    expect(handler).to.have.been.calledOnce;
    expect(never).to.not.have.been.called;
  });

  it('unsubscribes the handler when finished', async () => {
    const handler = sinon.spy();
    let result;
    function* gen() {
      result = yield teardown('result', handler);
      yield forever();
    }
    const saga = new Saga(gen());
    await delay(5);
    saga.cancel();
    expect(handler).to.not.have.been.called;
    expect(result).to.equal('result');
  });
});
