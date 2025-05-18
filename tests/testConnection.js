/**
 * Specialized connection handler for test environment
 */
const { Pool } = require('pg');
require('dotenv').config();

// Track active pools to ensure proper cleanup
let testPool = null;
let adminPool = null;

/**
 * Get or create a database connection pool for testing
 */
function getTestPool() {
  if (!testPool) {
    const connectionString = process.env.TEST_DATABASE_URL || 'postgres://postgres:123@localhost:5432/calliope_test';
    console.log('Using test database connection:', connectionString);
    
    testPool = new Pool({
      connectionString: connectionString,
      max: 5,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 5000
    });
    
    testPool.on('error', (err) => {
      console.error('Unexpected error on test client:', err);
    });
  }
  return testPool;
}

/**
 * Get or create an admin connection pool (for database management)
 */
function getAdminPool() {
  if (!adminPool) {
    const connectionString = process.env.TEST_DATABASE_URL || 'postgres://postgres:123@localhost:5432/calliope_test';
    const dbConfig = parseConnectionString(connectionString);
    
    adminPool = new Pool({
      user: dbConfig.user,
      password: dbConfig.password,
      host: dbConfig.host,
      port: dbConfig.port,
      database: 'postgres', // Connect to default postgres DB
      max: 2,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 5000
    });
    
    adminPool.on('error', (err) => {
      console.error('Unexpected error on admin client:', err);
    });
  }
  return adminPool;
}

/**
 * Parse a Postgres connection string into its components
 */
function parseConnectionString(connectionString) {
  const matches = connectionString.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!matches) {
    throw new Error(`Invalid connection string: ${connectionString}`);
  }
  return {
    user: matches[1],
    password: matches[2],
    host: matches[3],
    port: matches[4],
    database: matches[5]
  };
}

/**
 * Close all database connections
 */
async function closeAllPools() {
  const promises = [];
  
  if (testPool) {
    promises.push(
      testPool.end().catch(err => {
        console.error('Error closing test pool:', err);
      })
    );
    testPool = null;
  }
  
  if (adminPool) {
    promises.push(
      adminPool.end().catch(err => {
        console.error('Error closing admin pool:', err);
      })
    );
    adminPool = null;
  }
  
  await Promise.allSettled(promises);
}

/**
 * Get the test database name from the connection string
 */
function getTestDbName() {
  const connectionString = process.env.TEST_DATABASE_URL || 'postgres://postgres:123@localhost:5432/calliope_test';
  return parseConnectionString(connectionString).database;
}

// For backward compatibility
const pool = getTestPool();
const query = (text, params) => pool.query(text, params);

module.exports = {
  getTestPool,
  getAdminPool,
  closeAllPools,
  getTestDbName,
  parseConnectionString,
  // For backward compatibility
  pool,
  query
};
