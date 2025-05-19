
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const itemsRoutes = require('./routes/items');
const reviewsRoutes = require('./routes/reviews');
const commentsRoutes = require('./routes/comments');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/users', require('./routes/index'));

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Calliope API' });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Export the app for use in index.js and for testing
module.exports = app;
