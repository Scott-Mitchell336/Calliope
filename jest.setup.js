// Make sure we're using the test database
process.env.NODE_ENV = 'test';

// Store any hanging connections or servers
const openHandles = {
  servers: [],
  connections: []
};

// This will run before all tests
beforeAll(async () => {
  console.log('Global Jest setup - using test environment');
  
  // Configure Jest to fail on unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
});

// This will run after all tests are done
afterAll(async () => {
  console.log('Global Jest cleanup - closing all connections');
  
  // Close any tracked servers
  const serverPromises = openHandles.servers.map(server => 
    new Promise(resolve => {
      if (server && server.listening) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    })
  );
  
  await Promise.all(serverPromises);
  
  // Close any DB connections
  try {
    const connection = require('./db/connection');
    await connection.end();
  } catch (err) {
    console.error('Error closing global DB connection:', err);
  }
  
  // Also try closing the test setup connection
  try {
    const testSetup = require('./tests/testSetup');
    await testSetup.closeDbConnection();
  } catch (err) {
    console.error('Error closing test setup connection:', err);
  }
  
  // Add a delay to allow connections to close properly
  await new Promise(resolve => setTimeout(resolve, 2000));
});

// Export open handles tracker for tests to use
global.__TEST_OPEN_HANDLES__ = openHandles;
