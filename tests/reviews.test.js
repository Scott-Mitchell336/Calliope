const request = require('supertest');
const app = require('../app');
const { 
  setupTestDb, 
  cleanupTestDb, 
  closeDbConnection, 
  createTestServer,
  closeServer,
  testUsers, 
  testItems 
} = require('./testSetup');
const db = require('../db/connection');
const jwt = require('jsonwebtoken');
require('dotenv').config();

let testData;
let authToken;
let userId;
let itemId;
let reviewId;
let server;

beforeAll(async () => {
  testData = await setupTestDb();
  
  // Use a valid user ID from the database
  userId = testData.users[0].id;
  itemId = testData.items[0].id;
  reviewId = testData.reviews[0].id;
  
  // Create JWT token directly
  authToken = jwt.sign(
    { id: userId, username: testUsers[0].username },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  // Create test server
  server = createTestServer(app);
  // Track server in global handles
  global.__TEST_OPEN_HANDLES__.servers.push(server);
});

afterAll(async () => {
  await cleanupTestDb();
  await closeServer(server);
  await closeDbConnection();
});

describe('Reviews Routes', () => {
  describe('GET /api/reviews/me', () => {
    it('should return reviews created by the authenticated user', async () => {
      const response = await request(app)
        .get('/api/reviews/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('content');
      expect(response.body[0]).toHaveProperty('rating');
      expect(response.body[0]).toHaveProperty('item_id');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app).get('/api/reviews/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/users/:userId/reviews/:reviewId', () => {
    it('should update a user\'s review', async () => {
      const updatedReview = {
        content: 'Updated test review content',
        rating: 5
      };

      const response = await request(app)
        .put(`/api/users/${userId}/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedReview);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(reviewId);
      expect(response.body.content).toBe(updatedReview.content);
      expect(response.body.rating).toBe(updatedReview.rating);
      expect(response.body.user_id).toBe(userId);
    });

    it('should return 400 for invalid rating', async () => {
      const invalidReview = {
        content: 'Test review with invalid rating',
        rating: 6 // Invalid rating
      };

      const response = await request(app)
        .put(`/api/users/${userId}/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidReview);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 if not authenticated', async () => {
      const updatedReview = {
        content: 'Unauthorized update',
        rating: 3
      };

      const response = await request(app)
        .put(`/api/users/${userId}/reviews/${reviewId}`)
        .send(updatedReview);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 if user tries to update another user\'s review', async () => {
      // Create a token for a different user
      const otherUserToken = jwt.sign(
        { id: 999, username: 'otheruser' }, // Different user ID
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const updatedReview = {
        content: 'Trying to update someone else\'s review',
        rating: 2
      };

      const response = await request(app)
        .put(`/api/users/${userId}/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send(updatedReview);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent review', async () => {
      const updatedReview = {
        content: 'Update for non-existent review',
        rating: 4
      };

      const response = await request(app)
        .put(`/api/users/${userId}/reviews/9999`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedReview);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/users/:userId/reviews/:reviewId', () => {
    let deleteReviewId;
    
    beforeEach(async () => {
      // Use a different item to avoid unique constraint
      const secondItemId = testData.items[1].id;
      
      // Create a new review for delete testing
      // First, remove any existing reviews to avoid conflicts
      await db.query('DELETE FROM reviews WHERE user_id = $1 AND item_id = $2', [userId, secondItemId]);
      
      const result = await db.query(
        'INSERT INTO reviews (user_id, item_id, content, rating) VALUES ($1, $2, $3, $4) RETURNING id',
        [userId, secondItemId, 'Review to be deleted', 3]
      );
      
      deleteReviewId = result.rows[0].id;
    });
    
    it('should delete a user\'s review', async () => {
      const response = await request(app)
        .delete(`/api/users/${userId}/reviews/${deleteReviewId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deleted');

      // Verify the review was deleted
      const checkResult = await db.query('SELECT * FROM reviews WHERE id = $1', [deleteReviewId]);
      expect(checkResult.rows.length).toBe(0);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .delete(`/api/users/${userId}/reviews/${deleteReviewId}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 if user tries to delete another user\'s review', async () => {
      // Create a token for a different user
      const otherUserToken = jwt.sign(
        { id: 999, username: 'otheruser' }, // Different user ID
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .delete(`/api/users/${userId}/reviews/${deleteReviewId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent review', async () => {
      const response = await request(app)
        .delete(`/api/users/${userId}/reviews/9999`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });
});
