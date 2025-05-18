const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticateToken, checkUserAuthorization } = require('../middleware/auth');

// PUT /users/:userId/reviews/:reviewId - Edit a user's review
router.put('/:userId/reviews/:reviewId', authenticateToken, checkUserAuthorization, async (req, res) => {
  try {
    const { userId, reviewId } = req.params;
    const { content, rating } = req.body;

    if (!content || !rating) {
      return res.status(400).json({ error: 'Content and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if review exists and belongs to user
    const reviewCheck = await db.query(
      'SELECT * FROM reviews WHERE id = $1 AND user_id = $2',
      [reviewId, userId]
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found or not owned by user' });
    }

    // Update the review
    const result = await db.query(
      'UPDATE reviews SET content = $1, rating = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
      [content, rating, reviewId, userId]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /users/:userId/reviews/:reviewId - Delete a user's review
router.delete('/:userId/reviews/:reviewId', authenticateToken, checkUserAuthorization, async (req, res) => {
  try {
    const { userId, reviewId } = req.params;

    // Check if review exists and belongs to user
    const reviewCheck = await db.query(
      'SELECT * FROM reviews WHERE id = $1 AND user_id = $2',
      [reviewId, userId]
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found or not owned by user' });
    }

    // Delete the review
    await db.query(
      'DELETE FROM reviews WHERE id = $1 AND user_id = $2',
      [reviewId, userId]
    );

    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /users/:userId/comments/:commentId - Edit a user's comment
router.put('/:userId/comments/:commentId', authenticateToken, checkUserAuthorization, async (req, res) => {
  try {
    const { userId, commentId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Check if comment exists and belongs to user
    const commentCheck = await db.query(
      'SELECT * FROM comments WHERE id = $1 AND user_id = $2',
      [commentId, userId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found or not owned by user' });
    }

    // Update the comment
    const result = await db.query(
      'UPDATE comments SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *',
      [content, commentId, userId]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /users/:userId/comments/:commentId - Delete a user's comment
router.delete('/:userId/comments/:commentId', authenticateToken, checkUserAuthorization, async (req, res) => {
  try {
    const { userId, commentId } = req.params;

    // Check if comment exists and belongs to user
    const commentCheck = await db.query(
      'SELECT * FROM comments WHERE id = $1 AND user_id = $2',
      [commentId, userId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found or not owned by user' });
    }

    // Delete the comment
    await db.query(
      'DELETE FROM comments WHERE id = $1 AND user_id = $2',
      [commentId, userId]
    );

    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
