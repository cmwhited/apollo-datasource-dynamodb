module.exports = {
  verbose: true,
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  preset: 'jest-dynalite',
  testRegex: '/__tests__/.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/lib/'],
  collectCoverage: true,
  collectCoverageFrom: ['**/src/**/*', '!**/node_modules/', '!**/src/index.ts'],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 97,
    },
  },
};
