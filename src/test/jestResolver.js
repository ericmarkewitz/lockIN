// Jest runs Reanimated/Worklets on their web builds (Reanimated's documented resolver). Gesture
// Handler then has to take its matching web no-op for installing UI runtime bindings, or it asks
// the web Worklets build for a UI runtime it doesn't have.
const reanimatedResolver = require('react-native-reanimated/jest/resolver');

module.exports = (request, options) => {
  if (options.basedir.includes('react-native-gesture-handler') && request.endsWith('/installUIRuntimeBindings')) {
    return options.defaultResolver(`${request}.web`, options);
  }
  return reanimatedResolver(request, options);
};
