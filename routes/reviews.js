const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// GET /reviews/me - Get all reviews by the authenticated user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get reviews with item info
    const result = await db.query(
      `SELECT r.*, i.name as item_name, i.category as item_category 
       FROM reviews r
       JOIN items i ON r.item_id = i.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error getting user reviews:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
