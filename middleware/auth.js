const jwt = require('jsonwebtoken');
require('dotenv').config();

function authenticateToken(req, res, next) {
  // Get the auth header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Verify the token
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Add the user info to the request object
    req.user = user;
    next();
  });
}

// Middleware to check if user matches the user ID in params
function checkUserAuthorization(req, res, next) {
  // Check if the authenticated user matches the requested user ID
  if (req.user.id !== parseInt(req.params.userId)) {
    return res.status(403).json({ error: 'Unauthorized access to this resource' });
  }
  next();
}

module.exports = {
  authenticateToken,
  checkUserAuthorization
};
