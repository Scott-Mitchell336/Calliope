// This file runs once before all test files
const { resetTestDatabase } = require('./tests/testSetup');

module.exports = async () => {
  // Reset the database once globally before running any tests
  try {
    console.log('Global setup: Resetting test database...');
    await resetTestDatabase();
    console.log('Global setup: Test database reset complete');
  } catch (error) {
    console.error('Global setup: Error resetting test database:', error);
    // Don't throw here to allow tests to continue
  }
  
  // Add a small delay to ensure database operations complete
  await new Promise(resolve => setTimeout(resolve, 1000));
};
