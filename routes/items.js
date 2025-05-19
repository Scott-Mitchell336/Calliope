const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// GET /api/items - Get all items
router.get('/', async (req, res) => {
  try {
    // Support search by name or category
    const { search, category } = req.query;
    let query = 'SELECT * FROM items';
    const params = [];

    if (search || category) {
      query += ' WHERE';
      
      // Add search condition if provided
      if (search) {
        params.push(`%${search}%`);
        query += ` name ILIKE $${params.length}`;
      }

      // Add category condition if provided
      if (search && category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
      } else if (category) {
        params.push(category);
        query += ` category = $${params.length}`;
      }
    }

    // Just add order by without pagination
    query += ' ORDER BY name ASC';
    
    const result = await db.query(query, params);
    
    res.status(200).json({
      items: result.rows
    });
  } catch (error) {
    console.error('Error getting items:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/items/:itemId - Get a specific item
router.get('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    // Get item details
    const itemResult = await db.query(
      'SELECT * FROM items WHERE id = $1',
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Get average rating
    const ratingResult = await db.query(
      'SELECT AVG(rating)::numeric(10,2) as average_rating, COUNT(*) as review_count FROM reviews WHERE item_id = $1',
      [itemId]
    );

    const item = {
      ...itemResult.rows[0],
      average_rating: ratingResult.rows[0].average_rating || 0,
      review_count: parseInt(ratingResult.rows[0].review_count)
    };

    res.status(200).json(item);
  } catch (error) {
    console.error('Error getting item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/items/:itemId/reviews - Get all reviews for an item
router.get('/:itemId/reviews', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    
    // Check if item exists
    const itemCheck = await db.query(
      'SELECT * FROM items WHERE id = $1',
      [itemId]
    );

    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Get reviews with user info
    const result = await db.query(
      `SELECT r.*, u.username 
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.item_id = $1
       ORDER BY r.created_at DESC`,
      [itemId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error getting reviews for item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/items/:itemId/reviews/:reviewId - Get a specific review for an item
router.get('/:itemId/reviews/:reviewId', async (req, res) => {
  try {
    const { itemId, reviewId } = req.params;

    // Get review with user info
    const reviewResult = await db.query(
      `SELECT r.*, u.username 
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1 AND r.item_id = $2`,
      [reviewId, itemId]
    );

    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Get comments for this review
    const commentsResult = await db.query(
      `SELECT c.*, u.username 
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.review_id = $1
       ORDER BY c.created_at ASC`,
      [reviewId]
    );

    const review = {
      ...reviewResult.rows[0],
      comments: commentsResult.rows
    };

    res.status(200).json(review);
  } catch (error) {
    console.error('Error getting review:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/items/:itemId/reviews - Create a review for an item
router.post('/:itemId/reviews', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { content, rating } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!content || !rating) {
      return res.status(400).json({ error: 'Content and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if item exists
    const itemCheck = await db.query(
      'SELECT * FROM items WHERE id = $1',
      [itemId]
    );

    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Check if user already reviewed this item
    const existingReview = await db.query(
      'SELECT * FROM reviews WHERE user_id = $1 AND item_id = $2',
      [userId, itemId]
    );

    if (existingReview.rows.length > 0) {
      return res.status(400).json({ error: 'You have already reviewed this item' });
    }

    // Create review
    const result = await db.query(
      'INSERT INTO reviews (user_id, item_id, content, rating) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, itemId, content, rating]
    );

    // Get user info for the created review
    const userResult = await db.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );

    const review = {
      ...result.rows[0],
      username: userResult.rows[0].username
    };

    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/items/:itemId/reviews/:reviewId/comments - Add a comment to a review
router.post('/:itemId/reviews/:reviewId/comments', authenticateToken, async (req, res) => {
  try {
    const { itemId, reviewId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Check if review exists and belongs to specified item
    const reviewCheck = await db.query(
      'SELECT * FROM reviews WHERE id = $1 AND item_id = $2',
      [reviewId, itemId]
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found for this item' });
    }

    // Create comment
    const result = await db.query(
      'INSERT INTO comments (user_id, review_id, content) VALUES ($1, $2, $3) RETURNING *',
      [userId, reviewId, content]
    );

    // Get user info for the created comment
    const userResult = await db.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );

    const comment = {
      ...result.rows[0],
      username: userResult.rows[0].username
    };

    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
