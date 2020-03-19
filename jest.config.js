module.exports = {
  verbose: true,
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  testRegex: '(test|spec)\\.ts$',
  collectCoverage: true,
  collectCoverageFrom: ['**/src/**/*', '!**/node_modules/'],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 97,
    },
  },
};
