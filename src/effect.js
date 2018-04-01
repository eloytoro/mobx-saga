import Effect from './internal/Effect'

export default (payloadCreator, handler) => (...args) => (
  new Effect(payloadCreator(...args), handler)
);
