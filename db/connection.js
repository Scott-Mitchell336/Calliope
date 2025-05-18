const { Pool } = require('pg');
require('dotenv').config();

// Use test database URL if in test environment
const connectionString = process.env.NODE_ENV === 'test' 
  ? process.env.TEST_DATABASE_URL 
  : process.env.DATABASE_URL;

// Create a new pool using the connection string from environment variables
const pool = new Pool({
  connectionString: connectionString,
  // Basic settings for tests and development
  idleTimeoutMillis: process.env.NODE_ENV === 'test' ? 1000 : 30000,
  max: process.env.NODE_ENV === 'test' ? 5 : 20
});

// Add event handler for unexpected errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

// Simplified function to end the connection pool
const end = async () => {
  try {
    console.log('Closing database pool - active connections:', pool.totalCount, 'idle:', pool.idleCount);
    
    // Avoid duplicate end calls
    if (process.env.NODE_ENV === 'test' && pool._ending) {
      console.log('Pool already ending, skipping duplicate end call');
      return;
    }
    
    // Mark pool as ending
    pool._ending = true;
    
    // Simple cleanup for active connections in test environment
    if (process.env.NODE_ENV === 'test' && pool.totalCount > 0) {
      // Forcibly terminate any active clients in test environment
      const clients = pool._clients || [];
      for (const client of clients) {
        if (client && client.connection && client.connection.stream) {
          console.log('Terminating active client');
          client.connection.stream.destroy();
        }
      }
    }
    
    // End the pool with a timeout
    await Promise.race([
      pool.end(),
      new Promise(resolve => setTimeout(resolve, 1000))
    ]);
    
    console.log('Database pool has been closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

// Export a query function that can be used to run queries on the database
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  end
};
