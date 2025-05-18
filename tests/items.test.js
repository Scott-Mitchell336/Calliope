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

describe('Items Routes', () => {
  describe('GET /api/items', () => {
    it('should return a list of all items', async () => {
      const response = await request(app).get('/api/items');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should support search by name', async () => {
      const searchTerm = testItems[0].name.substring(0, 5); // Use part of the name for search
      
      const response = await request(app)
        .get('/api/items')
        .query({ search: searchTerm });

      expect(response.status).toBe(200);
      expect(response.body.items.some(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      )).toBe(true);
    });

    it('should support filtering by category', async () => {
      const response = await request(app)
        .get('/api/items')
        .query({ category: testItems[0].category });

      expect(response.status).toBe(200);
      expect(response.body.items.every(item => item.category === testItems[0].category)).toBe(true);
    });
  });

  describe('GET /api/items/:itemId', () => {
    it('should return a specific item with ratings', async () => {
      const response = await request(app).get(`/api/items/${itemId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(itemId);
      expect(response.body).toHaveProperty('average_rating');
      expect(response.body).toHaveProperty('review_count');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app).get('/api/items/9999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/items/:itemId/reviews', () => {
    it('should return reviews for a specific item when authenticated', async () => {
      const response = await request(app)
        .get(`/api/items/${itemId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('content');
      expect(response.body[0]).toHaveProperty('rating');
      expect(response.body[0]).toHaveProperty('username');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get(`/api/items/${itemId}/reviews`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .get('/api/items/9999/reviews')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/items/:itemId/reviews/:reviewId', () => {
    it('should return a specific review with comments', async () => {
      const response = await request(app).get(`/api/items/${itemId}/reviews/${reviewId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(reviewId);
      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('comments');
      expect(Array.isArray(response.body.comments)).toBe(true);
    });

    it('should return 404 for non-existent review', async () => {
      const response = await request(app).get(`/api/items/${itemId}/reviews/9999`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/items/:itemId/reviews', () => {
    // Use a different item for this test to avoid conflicts with existing reviews
    it('should create a new review for an item', async () => {
      // Use a different item to avoid unique constraint
      const secondItemId = testData.items[1].id;
      
      // First, delete any existing review for this user/item
      await db.query('DELETE FROM reviews WHERE user_id = $1 AND item_id = $2', [userId, secondItemId]);
      
      const newReview = {
        content: 'This is a test review for POST testing',
        rating: 4
      };
      
      const response = await request(app)
        .post(`/api/items/${secondItemId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(newReview);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe(newReview.content);
      expect(response.body.rating).toBe(newReview.rating);
    });

    it('should return 400 if user already reviewed the item', async () => {
      // This test relies on a review already existing in itemId for the test user
      // First, ensure we have a review for the first item
      const existingReviewResponse = await request(app)
        .get(`/api/items/${itemId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`);
        
      expect(existingReviewResponse.status).toBe(200);
      expect(existingReviewResponse.body.length).toBeGreaterThan(0);
      
      // Now try to add another review
      const duplicateReview = {
        content: 'This is a duplicate review that should fail',
        rating: 3
      };
      
      const response = await request(app)
        .post(`/api/items/${itemId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateReview);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid rating', async () => {
      const secondItemId = testData.items[1].id;
      
      const invalidReview = {
        content: 'This is a test review with invalid rating',
        rating: 6 // Invalid rating
      };
      
      const response = await request(app)
        .post(`/api/items/${secondItemId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidReview);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 if not authenticated', async () => {
      const secondItemId = testData.items[1].id;
      
      const newReview = {
        content: 'This is a test review without auth',
        rating: 4
      };
      
      const response = await request(app)
        .post(`/api/items/${secondItemId}/reviews`)
        .send(newReview);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/items/:itemId/reviews/:reviewId/comments', () => {
    it('should add a comment to a review', async () => {
      const newComment = {
        content: 'This is a test comment on a review'
      };
      
      const response = await request(app)
        .post(`/api/items/${itemId}/reviews/${reviewId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(newComment);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe(newComment.content);
    });

    it('should return 400 if content is missing', async () => {
      const invalidComment = {};
      
      const response = await request(app)
        .post(`/api/items/${itemId}/reviews/${reviewId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidComment);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent review', async () => {
      const newComment = {
        content: 'This is a test comment for a non-existent review'
      };
      
      const response = await request(app)
        .post(`/api/items/${itemId}/reviews/9999/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(newComment);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 if not authenticated', async () => {
      const newComment = {
        content: 'This is a test comment without auth'
      };
      
      const response = await request(app)
        .post(`/api/items/${itemId}/reviews/${reviewId}/comments`)
        .send(newComment);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});
