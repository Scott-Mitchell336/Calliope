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
let commentId;
let server;

beforeAll(async () => {
  testData = await setupTestDb();
  
  // Use a valid user ID from the database
  userId = testData.users[0].id;
  itemId = testData.items[0].id;
  reviewId = testData.reviews[0].id;
  commentId = testData.comments[0].id;
  
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

describe('Comments Routes', () => {
  describe('GET /api/comments/me', () => {
    it('should return comments created by the authenticated user', async () => {
      const response = await request(app)
        .get('/api/comments/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('content');
      expect(response.body[0]).toHaveProperty('review_id');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app).get('/api/comments/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/users/:userId/comments/:commentId', () => {
    it('should update a user\'s comment', async () => {
      const updatedComment = {
        content: 'Updated test comment content'
      };

      const response = await request(app)
        .put(`/api/users/${userId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedComment);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(commentId);
      expect(response.body.content).toBe(updatedComment.content);
      expect(response.body.user_id).toBe(userId);
    });

    it('should return 400 if content is missing', async () => {
      const invalidComment = {};

      const response = await request(app)
        .put(`/api/users/${userId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidComment);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 if not authenticated', async () => {
      const updatedComment = {
        content: 'Unauthorized update'
      };

      const response = await request(app)
        .put(`/api/users/${userId}/comments/${commentId}`)
        .send(updatedComment);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 if user tries to update another user\'s comment', async () => {
      // Create a token for a different user
      const otherUserToken = jwt.sign(
        { id: 999, username: 'otheruser' }, // Different user ID
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const updatedComment = {
        content: 'Trying to update someone else\'s comment'
      };

      const response = await request(app)
        .put(`/api/users/${userId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send(updatedComment);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent comment', async () => {
      const updatedComment = {
        content: 'Update for non-existent comment'
      };

      const response = await request(app)
        .put(`/api/users/${userId}/comments/9999`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedComment);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/users/:userId/comments/:commentId', () => {
    let deleteCommentId;
    
    beforeEach(async () => {
      // Create a new comment on the existing review
      const commentResult = await db.query(
        'INSERT INTO comments (user_id, review_id, content) VALUES ($1, $2, $3) RETURNING id',
        [userId, reviewId, 'Comment to be deleted']
      );
      
      deleteCommentId = commentResult.rows[0].id;
    });
    
    it('should delete a user\'s comment', async () => {
      const response = await request(app)
        .delete(`/api/users/${userId}/comments/${deleteCommentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deleted');

      // Verify the comment was deleted
      const checkResult = await db.query('SELECT * FROM comments WHERE id = $1', [deleteCommentId]);
      expect(checkResult.rows.length).toBe(0);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .delete(`/api/users/${userId}/comments/${deleteCommentId}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 if user tries to delete another user\'s comment', async () => {
      // Create a token for a different user
      const otherUserToken = jwt.sign(
        { id: 999, username: 'otheruser' }, // Different user ID
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .delete(`/api/users/${userId}/comments/${deleteCommentId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent comment', async () => {
      const response = await request(app)
        .delete(`/api/users/${userId}/comments/9999`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });
});
