// Activities tests - validates creating posts, replies, reacts, etc.
// Run with: node --test tests/activities.test.js

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { KowloonClient } from '../src/index.js';
import { getTestInviteCode } from './helpers/invite.js';

// Test configuration
const BASE_URL = process.env.KOWLOON_BASE_URL || 'http://localhost:3000';
const TEST_USERNAME = `test_act_${Date.now()}`;
const TEST_USERNAME2 = `test_act2_${Date.now()}`;
const TEST_PASSWORD = 'test_password_123';

describe('Kowloon Activities', () => {
  let client;
  let client2;
  let testUser2Id;
  let createdPostId;
  let createdReplyId;
  let createdReactId;

  before(async () => {
    console.log(`Testing against: ${BASE_URL}`);
    client = new KowloonClient({ baseUrl: BASE_URL });
    const inviteCode = await getTestInviteCode(BASE_URL);

    // Register and login first user
    await client.auth.register({
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
      inviteCode,
      profile: { name: 'Activity Test User' },
    });

    // Create second user for block/mute testing
    client2 = new KowloonClient({ baseUrl: BASE_URL });
    const registrationResult = await client2.auth.register({
      username: TEST_USERNAME2,
      password: TEST_PASSWORD,
      inviteCode,
      profile: { name: 'Activity Test User 2' },
    });
    testUser2Id = registrationResult.user.id;
    await client2.auth.logout();
  });

  after(async () => {
    // Cleanup: logout
    await client.auth.logout();
  });

  describe('Create Post', () => {
    it('should create a public post', async () => {
      const result = await client.activities.createPost({
        content: 'Hello from Kowloon client!',
        to: '@public',
      });

      assert.ok(result.ok, 'Should succeed');
      assert.ok(result.result, 'Should return result object');
      assert.ok(result.result.id, 'Post should have an ID');
      assert.strictEqual(result.result.source.content, 'Hello from Kowloon client!', 'Content should match');

      // Save for later tests
      createdPostId = result.result.id;
    });

    it('should create a private post (self-addressed)', async () => {
      const user = client.auth.getUser();

      const result = await client.activities.createPost({
        content: 'This is a private post',
        to: user.id, // Self-addressed (actorId)
        canReply: user.id,
        canReact: user.id,
      });

      assert.ok(result.ok, 'Should succeed');
      assert.ok(result.result.id, 'Post should have an ID');
      assert.strictEqual(result.result.to, user.id, 'Should be addressed to self');
    });

    it('should create post with custom type', async () => {
      const result = await client.activities.createPost({
        content: 'This is an article',
        type: 'Article',
        to: '@public',
        object: {
          name: 'My First Article',
        },
      });

      assert.ok(result.ok, 'Should succeed');
      assert.strictEqual(result.result.type, 'Article', 'Type should be Article');
    });

    it('should reject post without content', async () => {
      await assert.rejects(
        async () => {
          await client.activities.createPost({
            to: '@public',
          });
        },
        {
          name: 'ValidationError',
          message: /content is required/i,
        },
        'Should require content'
      );
    });
  });

  describe('Reply', () => {
    it('should reply to a post', async () => {
      assert.ok(createdPostId, 'Need a post to reply to');

      const result = await client.activities.reply({
        postId: createdPostId,
        content: 'This is a reply!',
      });

      assert.ok(result.ok, 'Should succeed');
      assert.ok(result.result, 'Should return result');
      assert.ok(result.result.id, 'Reply should have an ID');
      assert.strictEqual(result.result.target, createdPostId, 'Should reference original post');

      createdReplyId = result.result.id;
    });

    it('should reject reply without postId', async () => {
      await assert.rejects(
        async () => {
          await client.activities.reply({
            content: 'Reply content',
          });
        },
        {
          name: 'ValidationError',
          message: /postId is required/i,
        },
        'Should require postId'
      );
    });

    it('should reject reply without content', async () => {
      await assert.rejects(
        async () => {
          await client.activities.reply({
            postId: createdPostId,
          });
        },
        {
          name: 'ValidationError',
          message: /content is required/i,
        },
        'Should require content'
      );
    });
  });

  describe('React', () => {
    it('should react to a post', async () => {
      assert.ok(createdPostId, 'Need a post to react to');

      const result = await client.activities.react({
        postId: createdPostId,
        emoji: '👍',
      });

      assert.ok(result.ok, 'Should succeed');
      assert.ok(result.result, 'Should return result');
      assert.ok(result.result.status === 'reacted' || result.result.id, 'React should succeed');

      createdReactId = result.result.id || result.activity?.objectId;
    });

    it('should reject react without postId', async () => {
      await assert.rejects(
        async () => {
          await client.activities.react({
            emoji: '👍',
          });
        },
        {
          name: 'ValidationError',
          message: /postId is required/i,
        },
        'Should require postId'
      );
    });

    it('should reject react without emoji', async () => {
      await assert.rejects(
        async () => {
          await client.activities.react({
            postId: createdPostId,
          });
        },
        {
          name: 'ValidationError',
          message: /emoji is required/i,
        },
        'Should require emoji'
      );
    });
  });

  describe('Update Post', () => {
    it('should update post content', async () => {
      assert.ok(createdPostId, 'Need a post to update');

      const result = await client.activities.updatePost({
        postId: createdPostId,
        updates: {
          content: 'Updated content!',
        },
      });

      assert.ok(result.ok, 'Should succeed');
      assert.ok(result.result, 'Should return result');
    });

    it('should reject update without postId', async () => {
      await assert.rejects(
        async () => {
          await client.activities.updatePost({
            updates: { content: 'New content' },
          });
        },
        {
          name: 'ValidationError',
          message: /postId is required/i,
        },
        'Should require postId'
      );
    });
  });

  describe('Follow/Unfollow', () => {
    it('should follow a user', async () => {
      // Follow user 2
      assert.ok(testUser2Id, 'Need a second user to follow');

      const result = await client.activities.follow({
        userId: testUser2Id,
      });

      assert.ok(result.ok || result.result, 'Should succeed or return result');
    });

    it('should unfollow a user', async () => {
      assert.ok(testUser2Id, 'Need a second user to unfollow');

      const result = await client.activities.unfollow({
        userId: testUser2Id,
      });

      assert.ok(result.ok || result.result, 'Should succeed or return result');
    });
  });

  describe('Groups - Open', () => {
    let openGroupId;

    it('should create an open group', async () => {
      const result = await client.activities.createGroup({
        name: 'Open Test Group',
        description: 'An open group for testing',
        to: '@public',
      });

      assert.ok(result.ok, 'Should succeed');
      assert.ok(result.result, 'Should return result');
      assert.ok(result.result.id, 'Group should have an ID');
      assert.strictEqual(result.result.rsvpPolicy, 'open', 'Should default to open');

      openGroupId = result.result.id;
    });

    it('should join an open group (user 2)', async () => {
      assert.ok(openGroupId, 'Need a group to join');

      // Login as user 2
      await client2.auth.login({
        username: TEST_USERNAME2,
        password: TEST_PASSWORD,
      });

      const result = await client2.activities.joinGroup({
        groupId: openGroupId,
      });

      assert.ok(result.ok || result.result, 'Should succeed');
    });

    it('should leave an open group (user 2)', async () => {
      assert.ok(openGroupId, 'Need a group to leave');

      const result = await client2.activities.leaveGroup({
        groupId: openGroupId,
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      await client2.auth.logout();
    });
  });

  describe('Groups - Approval Required', () => {
    let approvalGroupId;

    it('should create an approval-required group', async () => {
      const result = await client.activities.createGroup({
        name: 'Approval Test Group',
        description: 'A group requiring approval',
        to: '@public',
        rsvpPolicy: 'approvalOnly',
      });

      assert.ok(result.ok, 'Should succeed');
      assert.ok(result.result, 'Should return result');
      assert.ok(result.result.id, 'Group should have an ID');
      assert.strictEqual(result.result.rsvpPolicy, 'approvalOnly', 'Should have approval policy');

      approvalGroupId = result.result.id;
    });

    it('should join approval group and be added to pending (user 2)', async () => {
      assert.ok(approvalGroupId, 'Need an approval group');

      // Login as user 2
      await client2.auth.login({
        username: TEST_USERNAME2,
        password: TEST_PASSWORD,
      });

      const result = await client2.activities.joinGroup({
        groupId: approvalGroupId,
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      assert.strictEqual(result.result?.status, 'pending', 'Should be pending approval');

      await client2.auth.logout();
    });

    it('should approve pending user (admin adds to members)', async () => {
      assert.ok(approvalGroupId, 'Need an approval group');
      assert.ok(testUser2Id, 'Need user 2 ID');

      // Admin (user 1) adds user 2 to members using new pattern
      const result = await client.http.post('/outbox', {
        type: 'Add',
        objectType: 'User',
        to: approvalGroupId,
        object: testUser2Id,
      });

      assert.ok(result.ok || result.added, 'Should succeed');
    });

    it('should remove user from group (admin removes from members)', async () => {
      assert.ok(approvalGroupId, 'Need an approval group');
      assert.ok(testUser2Id, 'Need user 2 ID');

      // Admin (user 1) removes user 2 from members using new pattern
      const result = await client.http.post('/outbox', {
        type: 'Remove',
        objectType: 'User',
        to: approvalGroupId,
        object: testUser2Id,
      });

      assert.ok(result.ok || result.removed, 'Should succeed');
    });

    it('should remove pending user (admin rejects)', async () => {
      assert.ok(approvalGroupId, 'Need an approval group');
      assert.ok(testUser2Id, 'Need user 2 ID');

      // User 2 joins again (will be pending)
      await client2.auth.login({
        username: TEST_USERNAME2,
        password: TEST_PASSWORD,
      });

      await client2.activities.joinGroup({
        groupId: approvalGroupId,
      });

      await client2.auth.logout();

      // Admin removes from pending (rejection)
      const result = await client.http.post('/outbox', {
        type: 'Remove',
        objectType: 'User',
        to: approvalGroupId,
        object: testUser2Id,
      });

      assert.ok(result.ok || result.removed, 'Should succeed');
    });
  });

  describe('Block/Unblock', () => {
    it('should block a user', async () => {
      assert.ok(testUser2Id, 'Need a second user to block');

      const result = await client.activities.block({
        userId: testUser2Id,
      });

      assert.ok(result.ok || result.activity, 'Should succeed or return activity');
    });

    it('should unblock a user', async () => {
      assert.ok(testUser2Id, 'Need a second user to unblock');

      const result = await client.activities.unblock({
        userId: testUser2Id,
      });

      assert.ok(result.ok || result.activity, 'Should succeed or return activity');
    });

    it('should reject block without userId', async () => {
      await assert.rejects(
        async () => {
          await client.activities.block({});
        },
        {
          name: 'ValidationError',
          message: /userId is required/i,
        },
        'Should require userId'
      );
    });
  });

  describe('Mute/Unmute', () => {
    it('should mute a user', async () => {
      assert.ok(testUser2Id, 'Need a second user to mute');

      const result = await client.activities.mute({
        userId: testUser2Id,
      });

      assert.ok(result.ok || result.activity, 'Should succeed or return activity');
    });

    it('should unmute a user', async () => {
      assert.ok(testUser2Id, 'Need a second user to unmute');

      const result = await client.activities.unmute({
        userId: testUser2Id,
      });

      assert.ok(result.ok || result.activity, 'Should succeed or return activity');
    });

    it('should reject mute without userId', async () => {
      await assert.rejects(
        async () => {
          await client.activities.mute({});
        },
        {
          name: 'ValidationError',
          message: /userId is required/i,
        },
        'Should require userId'
      );
    });
  });

  describe('Flag', () => {
    it('should flag a post', async () => {
      // Create a fresh post to flag
      const createResult = await client.activities.createPost({
        content: 'Post to flag',
        to: '@public',
      });

      const postToFlag = createResult.result.id;

      const result = await client.activities.flag({
        targetId: postToFlag,
        reason: 'spam',
        notes: 'This is a test flag',
      });

      assert.ok(result.ok || result.flag || result.activity, 'Should succeed or return flag');
    });

    it('should reject flag without targetId', async () => {
      await assert.rejects(
        async () => {
          await client.activities.flag({
            reason: 'spam',
          });
        },
        {
          name: 'ValidationError',
          message: /targetId is required/i,
        },
        'Should require targetId'
      );
    });

    it('should reject flag without reason', async () => {
      await assert.rejects(
        async () => {
          await client.activities.flag({
            targetId: createdPostId,
          });
        },
        {
          name: 'ValidationError',
          message: /reason is required/i,
        },
        'Should require reason'
      );
    });
  });

  describe('Delete', () => {
    it('should delete a post', async () => {
      // Create a post to delete
      const createResult = await client.activities.createPost({
        content: 'Post to delete',
        to: '@public',
      });

      const postId = createResult.result.id;

      const result = await client.activities.deletePost({
        postId,
      });

      assert.ok(result.ok || result.activity, 'Should succeed or return activity');
    });

    it('should reject delete without postId', async () => {
      await assert.rejects(
        async () => {
          await client.activities.deletePost({});
        },
        {
          name: 'ValidationError',
          message: /postId is required/i,
        },
        'Should require postId'
      );
    });
  });
});
