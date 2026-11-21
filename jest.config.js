// @ts-check
const preset = require('jest-expo/jest-preset');

const SOURCE = '\\.[jt]sx?$';
const [babelJest, babelOptions] = preset.transform[SOURCE];

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transform: {
    ...preset.transform,
    // Compile with the React Compiler, as Metro does for the app (`experiments.reactCompiler`),
    // so tests run the memoized code that ships rather than the source as written.
    [SOURCE]: [babelJest, { ...babelOptions, caller: { ...babelOptions.caller, supportsReactCompiler: true } }],
  },
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  resolver: '<rootDir>/src/test/jestResolver.js',
  testTimeout: 20000,
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
