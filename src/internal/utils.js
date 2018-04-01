export const defer = () => {
  const deferred = {};
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
};

export const isIterable = yielded =>
  typeof yielded === 'object' &&
  typeof yielded.next === 'function' &&
  typeof yielded.throw === 'function';
