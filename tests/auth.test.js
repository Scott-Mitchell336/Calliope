const request = require('supertest');
const app = require('../app');
const { 
  setupTestDb, 
  cleanupTestDb, 
  closeDbConnection, 
  createTestServer,
  closeServer,
  testUsers 
} = require('./testSetup');

let testData;
let server;

beforeAll(async () => {
  testData = await setupTestDb();
  
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

describe('Auth Routes', () => {
  let authToken;

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const timestamp = Date.now();
      const newUser = {
        username: `brandnewuser${timestamp}`,
        email: `brandnew${timestamp}@example.com`,
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(newUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.username).toBe(newUser.username);
      expect(response.body.email).toBe(newUser.email);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 400 if username already exists', async () => {
      const existingUser = {
        username: testUsers[0].username,
        email: 'different@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(existingUser);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Username already exists');
    });

    it('should return 400 if email already exists', async () => {
      // This now uses a unique username to isolate the email check
      const uniqueUsername = `unique${Date.now()}`;
      const existingEmail = {
        username: uniqueUsername,
        email: testUsers[0].email,
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(existingEmail);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Email already exists');
    });

    it('should return 400 if required fields are missing', async () => {
      const incompleteUser = {
        username: 'incompleteuser'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(incompleteUser);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/login', () => {
    it('should login a user and return a token', async () => {
      const loginUser = {
        username: testUsers[0].username,
        password: testUsers[0].password
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginUser);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe(loginUser.username);

      // Save token for future tests
      authToken = response.body.token;
    });

    it('should return 401 for invalid username', async () => {
      const invalidUser = {
        username: 'nonexistentuser',
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(invalidUser);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 for invalid password', async () => {
      const invalidPassword = {
        username: testUsers[0].username,
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(invalidPassword);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /auth/me', () => {
    it('should return the authenticated user', async () => {
      // First, register a new user
      const newUser = {
        username: 'authtestuser',
        email: 'authtest@example.com',
        password: 'password123'
      };
      
      await request(app)
        .post('/auth/register')
        .send(newUser);
      
      // Login to get a token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: newUser.username,
          password: newUser.password
        });

      const token = loginResponse.body.token;

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe(newUser.username);
      expect(response.body.email).toBe(newUser.email);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(app)
        .get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 if an invalid token is provided', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });
});
