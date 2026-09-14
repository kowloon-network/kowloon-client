// Auth tests - validates both client and server API
// Run with: node --test tests/auth.test.js

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { KowloonClient } from '../src/index.js';
import { getTestInviteCode } from './helpers/invite.js';

// Test configuration
const BASE_URL = process.env.KOWLOON_BASE_URL || 'http://localhost:3000';
const TEST_USERNAME = `test_${Date.now()}`;
const TEST_PASSWORD = 'test_password_123';

describe('Kowloon Auth', () => {
  let client;
  let inviteCode;

  before(async () => {
    console.log(`Testing against: ${BASE_URL}`);
    client = new KowloonClient({ baseUrl: BASE_URL });
    inviteCode = await getTestInviteCode(BASE_URL);
  });

  describe('Registration', () => {
    it('should register a new user', async () => {
      const result = await client.auth.register({
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
        inviteCode,
        email: `${TEST_USERNAME}@test.com`,
        profile: {
          name: 'Test User',
          description: 'A test user',
        },
      });

      assert.ok(result.token, 'Should return a token');
      assert.ok(result.user, 'Should return user object');
      assert.strictEqual(result.user.username, TEST_USERNAME, 'Username should match');
      assert.ok(result.user.id, 'User should have an ID');
      assert.ok(result.user.id.startsWith('@'), 'User ID should be in @user@domain format');
    });

    it('should reject duplicate username', async () => {
      try {
        await client.auth.register({
          username: TEST_USERNAME,
          password: TEST_PASSWORD,
          inviteCode,
        });
        assert.fail('Should have thrown an error for duplicate username');
      } catch (error) {
        assert.strictEqual(error.name, 'ValidationError', 'Should be a ValidationError');
        assert.ok(
          error.statusCode === 409 || error.statusCode === 400,
          'Status should be 409 (Conflict) or 400'
        );
        assert.ok(
          error.message.match(/already exists|conflict/i) || error.response?.error?.match(/already exists/i),
          'Error message should mention already exists or conflict'
        );
      }
    });

    it('should reject missing username', async () => {
      await assert.rejects(
        async () => {
          await client.auth.register({
            password: TEST_PASSWORD,
          });
        },
        {
          name: 'AuthenticationError',
          message: /required/i,
        },
        'Should require username'
      );
    });

    it('should reject missing password', async () => {
      await assert.rejects(
        async () => {
          await client.auth.register({
            username: 'someuser',
          });
        },
        {
          name: 'AuthenticationError',
          message: /required/i,
        },
        'Should require password'
      );
    });
  });

  describe('Login', () => {
    it('should login with username and password', async () => {
      // Logout first to clear token
      await client.auth.logout();

      const result = await client.auth.login({
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
      });

      assert.ok(result.token, 'Should return a token');
      assert.ok(result.user, 'Should return user object');
      assert.strictEqual(result.user.username, TEST_USERNAME, 'Username should match');
    });

    it('should login with user ID and password', async () => {
      // Logout first
      await client.auth.logout();

      // Get user ID from previous registration
      const registerResult = await client.auth.login({
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
      });
      const userId = registerResult.user.id;

      // Logout again
      await client.auth.logout();

      // Login with user ID
      const result = await client.auth.login({
        id: userId,
        password: TEST_PASSWORD,
      });

      assert.ok(result.token, 'Should return a token');
      assert.ok(result.user, 'Should return user object');
      assert.strictEqual(result.user.id, userId, 'User ID should match');
    });

    it('should reject invalid username', async () => {
      await assert.rejects(
        async () => {
          await client.auth.login({
            username: 'nonexistent_user',
            password: TEST_PASSWORD,
          });
        },
        {
          name: 'AuthenticationError',
          message: /invalid credentials/i,
        },
        'Should reject invalid username'
      );
    });

    it('should reject invalid password', async () => {
      await assert.rejects(
        async () => {
          await client.auth.login({
            username: TEST_USERNAME,
            password: 'wrong_password',
          });
        },
        {
          name: 'AuthenticationError',
          message: /invalid credentials/i,
        },
        'Should reject invalid password'
      );
    });

    it('should reject missing credentials', async () => {
      await assert.rejects(
        async () => {
          await client.auth.login({
            password: TEST_PASSWORD,
          });
        },
        {
          name: 'AuthenticationError',
          message: /required/i,
        },
        'Should require username or ID'
      );
    });
  });

  describe('Session', () => {
    it('should detect authenticated state', async () => {
      // Login first
      await client.auth.login({
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
      });

      const isAuth = await client.auth.isAuthenticated();
      assert.strictEqual(isAuth, true, 'Should be authenticated');

      const user = client.auth.getUser();
      assert.ok(user, 'Should have user object');
      assert.strictEqual(user.username, TEST_USERNAME, 'Username should match');
    });

    it('should logout and clear session', async () => {
      await client.auth.logout();

      const isAuth = await client.auth.isAuthenticated();
      assert.strictEqual(isAuth, false, 'Should not be authenticated');

      const user = client.auth.getUser();
      assert.strictEqual(user, null, 'User should be null');

      const token = await client.auth.getToken();
      assert.strictEqual(token, null, 'Token should be null');
    });

    it('should restore session from stored token', async () => {
      // Login to create a token
      await client.auth.login({
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
      });

      const originalToken = await client.auth.getToken();

      // Create a new client instance with shared storage (simulates app restart)
      const newClient = new KowloonClient({
        baseUrl: BASE_URL,
        storage: client.storage, // Share storage for test
      });

      // Restore session
      const user = await newClient.auth.restoreSession();

      assert.ok(user, 'Should restore user from token');
      assert.strictEqual(user.username, TEST_USERNAME, 'Username should match');

      const restoredToken = await newClient.auth.getToken();
      assert.strictEqual(restoredToken, originalToken, 'Token should be restored');
    });
  });

  describe('Token Management', () => {
    it('should include token in authenticated requests', async () => {
      // Login
      await client.auth.login({
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
      });

      const token = await client.auth.getToken();
      assert.ok(token, 'Should have token');

      // The token should be a JWT with 3 parts
      const parts = token.split('.');
      assert.strictEqual(parts.length, 3, 'Token should be a valid JWT');

      // Decode payload (not verifying, just checking structure)
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      assert.ok(payload.user, 'Token should contain user payload');
      assert.strictEqual(payload.user.username, TEST_USERNAME, 'Token username should match');
    });
  });
});
