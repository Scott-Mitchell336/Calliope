const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { 
  getAdminPool, 
  getTestPool, 
  closeAllPools, 
  getTestDbName 
} = require('./testConnection');
require('dotenv').config();

// Test data
const testUsers = [
  {
    username: 'testuser1',
    email: 'test1@example.com',
    password: 'password123'
  },
  {
    username: 'testuser2',
    email: 'test2@example.com',
    password: 'password123'
  }
];

const testItems = [
  {
    name: 'Test Item 1',
    description: 'This is a test item',
    category: 'Test Category',
    image_url: 'https://example.com/image1.jpg'
  },
  {
    name: 'Test Item 2',
    description: 'This is another test item',
    category: 'Test Category',
    image_url: 'https://example.com/image2.jpg'
  }
];

// Create and initialize test database
async function resetTestDatabase() {
  const testDbName = getTestDbName();
  const adminPool = getAdminPool();
  
  try {
    // Check if database exists and drop it
    try {
      // Terminate existing connections to the database more gently
      try {
        await adminPool.query(`
          SELECT pg_terminate_backend(pg_stat_activity.pid)
          FROM pg_stat_activity
          WHERE pg_stat_activity.datname = $1
          AND pid <> pg_backend_pid();
        `, [testDbName]);
      } catch (terminateErr) {
        console.log(`Warning: could not terminate existing connections: ${terminateErr.message}`);
        // Continue anyway, the drop database command will retry
      }
      
      // Add a small delay to allow connections to close gracefully
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Drop the database if it exists
      await adminPool.query(`DROP DATABASE IF EXISTS "${testDbName}";`);
      console.log(`Dropped existing database: ${testDbName}`);
    } catch (err) {
      console.log(`Database may not exist or could not be dropped: ${err.message}`);
      // Additional wait time if there was an error
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    try {
      // Create a fresh database 
      await adminPool.query(`CREATE DATABASE "${testDbName}";`);
      console.log(`Created fresh database: ${testDbName}`);
    } catch (createErr) {
      // If we failed to create the database, try one more time after a longer delay
      console.log(`Error creating database, retrying: ${createErr.message}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await adminPool.query(`CREATE DATABASE "${testDbName}";`);
      console.log(`Created fresh database on second attempt: ${testDbName}`);
    }
    
  } catch (err) {
    console.error('Error resetting test database:', err);
    throw err;
  }
}

// Setup test database
async function setupTestDb() {
  try {
    // Reset the database to ensure a clean environment
    await resetTestDatabase();
    
    // Get connection pool
    const pool = getTestPool();
    
    // Reconnect to the freshly created database
    try {
      await pool.query('SELECT NOW()'); // Test connection
    } catch (err) {
      console.log('Connection test failed, waiting 1 second before retry...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await pool.query('SELECT NOW()'); // Retry connection
    }
    
    // Load schema but execute the commands one by one to avoid schema execution issues
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements and execute them sequentially
    const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);
    for (const statement of statements) {
      await pool.query(statement + ';');
    }
    
    // Insert test users
    const users = [];
    for (const user of testUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const result = await pool.query(
        'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
        [user.username, user.email, hashedPassword]
      );
      users.push(result.rows[0]);
    }
    
    // Insert test items
    const items = [];
    for (const item of testItems) {
      const result = await pool.query(
        'INSERT INTO items (name, description, category, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
        [item.name, item.description, item.category, item.image_url]
      );
      items.push(result.rows[0]);
    }
    
    console.log("Setting up test data with users:", users[0].id, "and items:", items[0].id);
    
    // Create test reviews
    const reviews = [];
    // Add a review from user 1 for item 1
    const review1Result = await pool.query(
      'INSERT INTO reviews (user_id, item_id, content, rating) VALUES ($1, $2, $3, $4) RETURNING *',
      [users[0].id, items[0].id, 'Test review for item 1', 4]
    );
    reviews.push(review1Result.rows[0]);
    
    // Add a review from user 1 for item 2
    const review2Result = await pool.query(
      'INSERT INTO reviews (user_id, item_id, content, rating) VALUES ($1, $2, $3, $4) RETURNING *',
      [users[0].id, items[1].id, 'Test review for item 2', 5]
    );
    reviews.push(review2Result.rows[0]);
    
    // Create test comments
    const comments = [];
    // Add a comment from user 1 on review 1
    const comment1Result = await pool.query(
      'INSERT INTO comments (user_id, review_id, content) VALUES ($1, $2, $3) RETURNING *',
      [users[0].id, reviews[0].id, 'Test comment on review 1']
    );
    comments.push(comment1Result.rows[0]);
    
    // Add a comment from user 2 on review 1
    const comment2Result = await pool.query(
      'INSERT INTO comments (user_id, review_id, content) VALUES ($1, $2, $3) RETURNING *',
      [users[1].id, reviews[0].id, 'Another test comment on review 1']
    );
    comments.push(comment2Result.rows[0]);
    
    return { 
      users, 
      items, 
      reviews, 
      comments 
    };
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  }
}

// Cleanup test database
async function cleanupTestDb() {
  try {
    const pool = getTestPool();
    
    // Delete data in reverse order of dependencies
    await pool.query('DELETE FROM comments');
    await pool.query('DELETE FROM reviews');
    await pool.query('DELETE FROM items');
    await pool.query('DELETE FROM users');
    console.log('Test database cleaned up');
  } catch (error) {
    console.error('Error cleaning up test database:', error.message);
    // Continue despite errors to ensure tests can proceed
  }
}

// Create a server instance for testing
const createTestServer = (app) => {
  const http = require('http');
  const server = http.createServer(app);
  server.listen(0); // Use random available port
  return server;
};

// Close database connection
async function closeDbConnection() {
  try {
    console.log('Closing database connection...');
    
    // Close all pools from testConnection
    try {
      await closeAllPools();
    } catch (poolErr) {
      console.log(`Warning: Error closing pools: ${poolErr.message}`);
    }
    
    // Use the exported end method from connection.js
    try {
      const connection = require('../db/connection');
      await connection.end();
    } catch (connErr) {
      console.log(`Warning: Error ending connection from connection.js: ${connErr.message}`);
    }
    
    console.log('Database connection closed successfully');
  } catch (error) {
    console.error('Error closing database connection:', error);
    // Don't throw here to avoid test failures during cleanup
  }
}

// Close server
async function closeServer(server) {
  return new Promise((resolve) => {
    if (server && server.listening) {
      console.log('Closing test server...');
      server.close((err) => {
        if (err) {
          console.error('Error closing server:', err);
          // Still resolve even if there's an error to prevent test hanging
        }
        console.log('Test server closed successfully');
        resolve();
      });
    } else {
      console.log('Server not running or already closed');
      resolve();
    }
  });
}

module.exports = {
  setupTestDb,
  cleanupTestDb,
  closeDbConnection,
  closeServer,
  createTestServer,
  resetTestDatabase,
  testUsers,
  testItems
};
