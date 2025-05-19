const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// GET /api/comments/me - Get all comments by the authenticated user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get comments with review and item info
    const result = await db.query(
      `SELECT c.*, r.content as review_content, i.id as item_id, i.name as item_name
       FROM comments c
       JOIN reviews r ON c.review_id = r.id
       JOIN items i ON r.item_id = i.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error getting user comments:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
