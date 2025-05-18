
require('dotenv').config();
const app = require('./app');

// Get port from environment variables or use default
const PORT = process.env.PORT || 3000;

// Only start the server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  // Start server
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
} else {
  console.log('Running in test mode - server not started');
}
