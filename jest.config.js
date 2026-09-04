module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'babel-jest',
  },
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
  ],
};
