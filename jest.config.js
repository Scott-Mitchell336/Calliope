module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./jest.setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  forceExit: true,         // Add this back to ensure process exits
  maxWorkers: 1,           // Run tests serially (one at a time)
  bail: true,              // Stop running tests after the first failure
  testTimeout: 30000       // Increase timeout for slow tests
};
