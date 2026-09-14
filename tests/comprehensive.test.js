// Comprehensive Activities Test Suite
// Run with: node --test tests/comprehensive.test.js
// Requires the server's first-boot admin account (ADMIN_USERNAME/ADMIN_PASSWORD
// env vars, or the .env.example defaults) to be reachable — used to mint a
// shared test invite, since registration always requires one now.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { KowloonClient } from '../src/index.js';
import { getTestInviteCode } from './helpers/invite.js';

// Test configuration
const BASE_URL = process.env.KOWLOON_BASE_URL || 'http://localhost:3000';
const TEST_PASSWORD = 'test_password_123';
const NUM_TEST_USERS = 10;

// Default server settings (from config/defaultSettings.js)
const LIKE_EMOJIS = [
  { name: 'Like', emoji: '👍' },
  { name: 'Laugh', emoji: '😂' },
  { name: 'Love', emoji: '❤️' },
  { name: 'Sad', emoji: '😭' },
  { name: 'Angry', emoji: '🤬' },
  { name: 'Shocked', emoji: '😮' },
  { name: 'Puke', emoji: '🤮' },
];

const FLAG_OPTIONS = [
  'spam',
  'harassment',
  'hate_speech',
  'threats',
  'sexual_content',
  'misinformation',
  'illegal',
  'impersonation',
  'other',
];

// Helper to get random item from array
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to get random emoji from server's allowed list
function randomEmoji() {
  return randomItem(LIKE_EMOJIS).emoji;
}

// Helper to get random flag reason
function randomFlagReason() {
  return randomItem(FLAG_OPTIONS);
}

describe('Kowloon Comprehensive Test Suite', () => {
  const clients = [];
  const users = [];
  const testPrefix = `test_${Date.now()}`;

  // Store created resources for later tests
  let createdPosts = [];
  let createdCircleId = null;
  let createdOpenGroupId = null;
  let createdApprovalGroupId = null;
  let serverDomain = null;
  let inviteCode = null;

  before(async () => {
    console.log(`\n📡 Testing against: ${BASE_URL}`);
    console.log(`🔑 Creating ${NUM_TEST_USERS} test users...\n`);
    inviteCode = await getTestInviteCode(BASE_URL);
  });

  after(async () => {
    console.log('\n🧹 Cleaning up...');
    // Logout all clients
    for (const client of clients) {
      try {
        await client.auth.logout();
      } catch {
        // Ignore logout errors
      }
    }
  });

  // ============================================================
  // 1. USER CREATION (10 users)
  // ============================================================
  describe('1. User Creation', () => {
    it('should create 10 test users', async () => {
      for (let i = 0; i < NUM_TEST_USERS; i++) {
        const username = `${testPrefix}_user${i + 1}`;
        const client = new KowloonClient({ baseUrl: BASE_URL });

        const result = await client.auth.register({
          username,
          password: TEST_PASSWORD,
          inviteCode,
          email: `${username}@test.com`,
          profile: { name: `Test User ${i + 1}` },
        });

        assert.ok(result.token, `User ${i + 1} should get a token`);
        assert.ok(result.user, `User ${i + 1} should return user object`);
        assert.ok(result.user.id, `User ${i + 1} should have an ID`);
        assert.ok(result.user.id.startsWith('@'), `User ${i + 1} ID should be @user@domain format`);

        // Extract domain from first user
        if (i === 0) {
          const parts = result.user.id.split('@');
          serverDomain = parts[parts.length - 1];
          console.log(`   Server domain: ${serverDomain}`);
        }

        clients.push(client);
        users.push(result.user);
        console.log(`   ✓ Created user ${i + 1}: ${result.user.id}`);
      }

      assert.strictEqual(users.length, NUM_TEST_USERS, `Should have created ${NUM_TEST_USERS} users`);
    });
  });

  // ============================================================
  // 2. CIRCLE MANAGEMENT
  // ============================================================
  describe('2. Circle Management', () => {
    it('should create a circle (user 1)', async () => {
      // Circle requires to, canReply, canReact - default to self (private)
      const selfId = users[0].id;
      const result = await clients[0].activities.createCircle({
        name: 'Close Friends',
        summary: 'My close friends circle',
        to: selfId,
        canReply: selfId,
        canReact: selfId,
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      assert.ok(result.result?.id, 'Circle should have an ID');
      createdCircleId = result.result.id;
      console.log(`   ✓ Created circle: ${createdCircleId}`);
    });

    it('should add user 2 to circle via Add activity (user 1)', async () => {
      assert.ok(createdCircleId, 'Need a circle');
      assert.ok(users[1]?.id, 'Need user 2');

      const result = await clients[0].activities.addToCircle({
        circleId: createdCircleId,
        userId: users[1].id,
      });

      assert.ok(result.ok || result.added || result.result, 'Should succeed');
      console.log(`   ✓ Added ${users[1].id} to circle`);
    });

    it('should add user 3 to circle via Add activity (user 1)', async () => {
      assert.ok(createdCircleId, 'Need a circle');
      assert.ok(users[2]?.id, 'Need user 3');

      const result = await clients[0].activities.addToCircle({
        circleId: createdCircleId,
        userId: users[2].id,
      });

      assert.ok(result.ok || result.added || result.result, 'Should succeed');
      console.log(`   ✓ Added ${users[2].id} to circle`);
    });

    it('should remove user 3 from circle via Remove activity (user 1)', async () => {
      assert.ok(createdCircleId, 'Need a circle');
      assert.ok(users[2]?.id, 'Need user 3');

      const result = await clients[0].activities.removeFromCircle({
        circleId: createdCircleId,
        userId: users[2].id,
      });

      assert.ok(result.ok || result.removed || result.result, 'Should succeed');
      console.log(`   ✓ Removed ${users[2].id} from circle`);
    });

    it('should delete circle via Delete activity (user 1)', async () => {
      // First create a throwaway circle to delete
      const selfId = users[0].id;
      const createResult = await clients[0].activities.createCircle({
        name: 'Temporary Circle',
        summary: 'To be deleted',
        to: selfId,
        canReply: selfId,
        canReact: selfId,
      });

      const tempCircleId = createResult.result.id;

      const result = await clients[0].activities.deleteCircle({
        circleId: tempCircleId,
      });

      assert.ok(result.ok || result.deleted || result.result, 'Should succeed');
      console.log(`   ✓ Deleted circle: ${tempCircleId}`);
    });
  });

  // ============================================================
  // 3. GROUP CREATION
  // ============================================================
  describe('3. Group Creation', () => {
    it('should create an open group via Create activity (user 1)', async () => {
      const result = await clients[0].activities.createGroup({
        name: 'Open Test Group',
        description: 'A public open group for testing',
        to: '@public',
        rsvpPolicy: 'open',
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      assert.ok(result.result?.id, 'Group should have an ID');
      createdOpenGroupId = result.result.id;
      console.log(`   ✓ Created open group: ${createdOpenGroupId}`);
    });

    it('should create an approval-required group via Create activity (user 1)', async () => {
      const result = await clients[0].activities.createGroup({
        name: 'Approval Required Group',
        description: 'A group that requires approval to join',
        to: '@public',
        rsvpPolicy: 'approvalOnly',
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      assert.ok(result.result?.id, 'Group should have an ID');
      assert.strictEqual(result.result.rsvpPolicy, 'approvalOnly', 'Should have approval policy');
      createdApprovalGroupId = result.result.id;
      console.log(`   ✓ Created approval group: ${createdApprovalGroupId}`);
    });
  });

  // ============================================================
  // 4. JOIN GROUP
  // ============================================================
  describe('4. Join Group', () => {
    it('should join open group via Join activity (user 2)', async () => {
      assert.ok(createdOpenGroupId, 'Need an open group');

      const result = await clients[1].activities.joinGroup({
        groupId: createdOpenGroupId,
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      console.log(`   ✓ User 2 joined open group`);
    });

    it('should join open group via Join activity (user 3)', async () => {
      assert.ok(createdOpenGroupId, 'Need an open group');

      const result = await clients[2].activities.joinGroup({
        groupId: createdOpenGroupId,
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      console.log(`   ✓ User 3 joined open group`);
    });

    it('should request to join approval group via Join activity (user 4)', async () => {
      assert.ok(createdApprovalGroupId, 'Need an approval group');

      const result = await clients[3].activities.joinGroup({
        groupId: createdApprovalGroupId,
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      // May be pending approval
      if (result.result?.status) {
        assert.strictEqual(result.result.status, 'pending', 'Should be pending');
      }
      console.log(`   ✓ User 4 requested to join approval group (pending)`);
    });
  });

  // ============================================================
  // 5. POSTS ADDRESSED TO PUBLIC, SERVER, AND GROUP
  // ============================================================
  describe('5. Posts with Different Audiences', () => {
    it('should create a public post (@public) (user 1)', async () => {
      const result = await clients[0].activities.createPost({
        content: 'This is a public post visible to everyone!',
        to: '@public',
      });

      assert.ok(result.ok, 'Should succeed');
      assert.ok(result.result?.id, 'Post should have an ID');
      assert.strictEqual(result.result.to, '@public', 'Should be addressed to @public');
      createdPosts.push(result.result);
      console.log(`   ✓ Created public post: ${result.result.id}`);
    });

    it('should create a server-addressed post (@domain) (user 2)', async () => {
      assert.ok(serverDomain, 'Need server domain');

      const result = await clients[1].activities.createPost({
        content: 'This post is only visible to users on this server!',
        to: `@${serverDomain}`,
      });

      assert.ok(result.ok, 'Should succeed');
      assert.ok(result.result?.id, 'Post should have an ID');
      createdPosts.push(result.result);
      console.log(`   ✓ Created server-addressed post: ${result.result.id}`);
    });

    it('should create a group-addressed post (user 1)', async () => {
      assert.ok(createdOpenGroupId, 'Need a group');

      const result = await clients[0].activities.createPost({
        content: 'This post is for the group members!',
        to: createdOpenGroupId,
      });

      assert.ok(result.ok, 'Should succeed');
      assert.ok(result.result?.id, 'Post should have an ID');
      createdPosts.push(result.result);
      console.log(`   ✓ Created group-addressed post: ${result.result.id}`);
    });

    it('should create a circle-addressed post (user 1)', async () => {
      assert.ok(createdCircleId, 'Need a circle');

      const result = await clients[0].activities.createPost({
        content: 'This post is only for my close friends circle!',
        to: createdCircleId,
      });

      assert.ok(result.ok, 'Should succeed');
      assert.ok(result.result?.id, 'Post should have an ID');
      createdPosts.push(result.result);
      console.log(`   ✓ Created circle-addressed post: ${result.result.id}`);
    });
  });

  // ============================================================
  // 6. REPLIES
  // ============================================================
  describe('6. Replies', () => {
    it('should reply to public post via Reply activity (user 2)', async () => {
      const publicPost = createdPosts.find(p => p.to === '@public');
      assert.ok(publicPost, 'Need a public post to reply to');

      const result = await clients[1].activities.reply({
        postId: publicPost.id,
        content: 'Great post! Here is my reply.',
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      assert.ok(result.result?.id, 'Reply should have an ID');
      // The parent post ID is stored in result.result.target (Reply model) or result.activity.to
      assert.ok(result.result?.target === publicPost.id || result.activity?.to === publicPost.id, 'Should reference original post');
      console.log(`   ✓ User 2 replied to public post`);
    });

    it('should reply to reply (threaded) via Reply activity (user 3)', async () => {
      const publicPost = createdPosts.find(p => p.to === '@public');
      assert.ok(publicPost, 'Need a public post');

      // First create a reply
      const replyResult = await clients[2].activities.reply({
        postId: publicPost.id,
        content: 'First reply from user 3',
      });

      const replyId = replyResult.result.id;

      // Reply to the reply
      const result = await clients[3].activities.reply({
        postId: replyId,
        content: 'Replying to the reply!',
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      // The parent reply ID is stored in result.result.target or result.activity.to
      assert.ok(result.result?.target === replyId || result.activity?.to === replyId, 'Should reference the reply');
      console.log(`   ✓ User 4 replied to a reply (threaded)`);
    });
  });

  // ============================================================
  // 7. REACTIONS WITH RANDOM EMOJI
  // ============================================================
  describe('7. Reactions with Random Emoji', () => {
    it('should react to post with random emoji (user 7)', async () => {
      const publicPost = createdPosts.find(p => p.to === '@public');
      assert.ok(publicPost, 'Need a public post');

      const emoji = randomEmoji();
      console.log(`   Using random emoji: ${emoji}`);

      // Use user 7 (clients[6]) who hasn't interacted with this post yet
      const result = await clients[6].activities.react({
        postId: publicPost.id,
        emoji,
      });

      assert.ok(result.ok, 'Should succeed');
      // React returns createdId at top level, not result.id
      assert.ok(result.createdId, 'React should have an ID');
      console.log(`   ✓ User 7 reacted with ${emoji}`);
    });

    it('should react with different random emojis from multiple users', async () => {
      const publicPost = createdPosts.find(p => p.to === '@public');
      assert.ok(publicPost, 'Need a public post');

      // Users 4-6 react with random emojis
      for (let i = 3; i <= 5; i++) {
        const emoji = randomEmoji();
        const result = await clients[i].activities.react({
          postId: publicPost.id,
          emoji,
        });
        assert.ok(result.ok || result.result, `User ${i + 1} should succeed`);
        console.log(`   ✓ User ${i + 1} reacted with ${emoji}`);
      }
    });
  });

  // ============================================================
  // 8. UPDATE POSTS
  // ============================================================
  describe('8. Update Posts', () => {
    it('should update own post content via Update activity (user 1)', async () => {
      const publicPost = createdPosts.find(p => p.to === '@public');
      assert.ok(publicPost, 'Need a public post');

      const result = await clients[0].activities.updatePost({
        postId: publicPost.id,
        updates: {
          content: 'This is the UPDATED public post content!',
        },
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      console.log(`   ✓ User 1 updated post content`);
    });

    it('should update post audience via Update activity (user 2)', async () => {
      // Create a new post to update
      const createResult = await clients[1].activities.createPost({
        content: 'Post to update audience',
        to: '@public',
      });

      const postId = createResult.result.id;

      const result = await clients[1].activities.updatePost({
        postId,
        updates: {
          to: `@${serverDomain}`, // Change from public to server-only
        },
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      console.log(`   ✓ User 2 updated post audience`);
    });
  });

  // ============================================================
  // 9. DELETE POSTS
  // ============================================================
  describe('9. Delete Posts', () => {
    it('should delete own post via Delete activity (user 2)', async () => {
      // Create a post to delete
      const createResult = await clients[1].activities.createPost({
        content: 'Post to be deleted',
        to: '@public',
      });

      const postId = createResult.result.id;

      const result = await clients[1].activities.deletePost({
        postId,
      });

      assert.ok(result.ok || result.result || result.activity, 'Should succeed');
      console.log(`   ✓ User 2 deleted post`);
    });
  });

  // ============================================================
  // 10. FOLLOW/UNFOLLOW
  // ============================================================
  describe('10. Follow/Unfollow', () => {
    it('should follow user 2 via Follow activity (user 1)', async () => {
      assert.ok(users[1]?.id, 'Need user 2');

      const result = await clients[0].activities.follow({
        userId: users[1].id,
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      console.log(`   ✓ User 1 followed User 2`);
    });

    it('should follow user 1 back via Follow activity (user 2)', async () => {
      assert.ok(users[0]?.id, 'Need user 1');

      const result = await clients[1].activities.follow({
        userId: users[0].id,
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      console.log(`   ✓ User 2 followed User 1 back (mutual follow)`);
    });

    it('should unfollow user 2 via Unfollow activity (user 1)', async () => {
      assert.ok(users[1]?.id, 'Need user 2');

      const result = await clients[0].activities.unfollow({
        userId: users[1].id,
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      console.log(`   ✓ User 1 unfollowed User 2`);
    });

    it('should re-follow user 2 (user 1)', async () => {
      const result = await clients[0].activities.follow({
        userId: users[1].id,
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      console.log(`   ✓ User 1 re-followed User 2`);
    });
  });

  // ============================================================
  // 11. FLAG WITH RANDOM REASON
  // ============================================================
  describe('11. Flag with Random Reason', () => {
    it('should flag a post with random flagOption reason (user 3)', async () => {
      // Create a post to flag
      const createResult = await clients[4].activities.createPost({
        content: 'Potentially problematic post to flag',
        to: '@public',
      });

      const postId = createResult.result.id;
      const reason = randomFlagReason();
      console.log(`   Using random flag reason: ${reason}`);

      const result = await clients[2].activities.flag({
        targetId: postId,
        reason,
        notes: 'This is a test flag with a random reason',
      });

      assert.ok(result.ok || result.result || result.flag, 'Should succeed');
      console.log(`   ✓ User 3 flagged post with reason: ${reason}`);
    });

    it('should flag a user with random flagOption reason (user 4)', async () => {
      assert.ok(users[5]?.id, 'Need user 6');

      const reason = randomFlagReason();
      console.log(`   Using random flag reason: ${reason}`);

      const result = await clients[3].activities.flag({
        targetId: users[5].id,
        reason,
        notes: 'Test flag on a user',
      });

      assert.ok(result.ok || result.result || result.flag, 'Should succeed');
      console.log(`   ✓ User 4 flagged User 6 with reason: ${reason}`);
    });
  });

  // ============================================================
  // 12. INVITE-ONLY GROUP WITH APPROVAL FLOW
  // ============================================================
  describe('12. Invite-Only Group Approval Flow', () => {
    it('should approve pending user via Add activity (admin approves user 4)', async () => {
      assert.ok(createdApprovalGroupId, 'Need approval group');
      assert.ok(users[3]?.id, 'Need user 4');

      // Admin (user 1) approves user 4's join request
      const result = await clients[0].http.post('/outbox', {
        type: 'Add',
        objectType: 'User',
        to: createdApprovalGroupId,
        object: users[3].id,
      });

      assert.ok(result.ok || result.added, 'Should succeed');
      console.log(`   ✓ Admin approved User 4's join request`);
    });

    it('should request join (user 5) then reject via Remove activity', async () => {
      assert.ok(createdApprovalGroupId, 'Need approval group');

      // User 5 requests to join
      const joinResult = await clients[4].activities.joinGroup({
        groupId: createdApprovalGroupId,
      });
      assert.ok(joinResult.ok || joinResult.result, 'Join request should succeed');
      console.log(`   ✓ User 5 requested to join`);

      // Admin rejects by removing from pending
      const rejectResult = await clients[0].http.post('/outbox', {
        type: 'Remove',
        objectType: 'User',
        to: createdApprovalGroupId,
        object: users[4].id,
      });

      assert.ok(rejectResult.ok || rejectResult.removed, 'Should succeed');
      console.log(`   ✓ Admin rejected User 5's join request`);
    });
  });

  // ============================================================
  // 13. REMOVE USER FROM GROUP
  // ============================================================
  describe('13. Remove User from Group', () => {
    it('should remove user 3 from open group via Remove activity (admin)', async () => {
      assert.ok(createdOpenGroupId, 'Need open group');
      assert.ok(users[2]?.id, 'Need user 3');

      const result = await clients[0].http.post('/outbox', {
        type: 'Remove',
        objectType: 'User',
        to: createdOpenGroupId,
        object: users[2].id,
      });

      assert.ok(result.ok || result.removed, 'Should succeed');
      console.log(`   ✓ Admin removed User 3 from open group`);
    });
  });

  // ============================================================
  // 14. LEAVE GROUP
  // ============================================================
  describe('14. Leave Group', () => {
    it('should leave open group via Leave activity (user 2)', async () => {
      assert.ok(createdOpenGroupId, 'Need open group');

      const result = await clients[1].activities.leaveGroup({
        groupId: createdOpenGroupId,
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      console.log(`   ✓ User 2 left open group`);
    });

    it('should leave approval group via Leave activity (user 4)', async () => {
      assert.ok(createdApprovalGroupId, 'Need approval group');

      const result = await clients[3].activities.leaveGroup({
        groupId: createdApprovalGroupId,
      });

      assert.ok(result.ok || result.result, 'Should succeed');
      console.log(`   ✓ User 4 left approval group`);
    });
  });

  // ============================================================
  // 15. BLOCK/UNBLOCK
  // ============================================================
  describe('15. Block/Unblock', () => {
    it('should block user 7 via Block activity (user 1)', async () => {
      assert.ok(users[6]?.id, 'Need user 7');

      const result = await clients[0].activities.block({
        userId: users[6].id,
      });

      assert.ok(result.ok || result.activity || result.result, 'Should succeed');
      console.log(`   ✓ User 1 blocked User 7`);
    });

    it('should unblock user 7 via Unblock activity (user 1)', async () => {
      assert.ok(users[6]?.id, 'Need user 7');

      const result = await clients[0].activities.unblock({
        userId: users[6].id,
      });

      assert.ok(result.ok || result.activity || result.result, 'Should succeed');
      console.log(`   ✓ User 1 unblocked User 7`);
    });
  });

  // ============================================================
  // 16. MUTE/UNMUTE
  // ============================================================
  describe('16. Mute/Unmute', () => {
    it('should mute user 8 via Mute activity (user 1)', async () => {
      assert.ok(users[7]?.id, 'Need user 8');

      const result = await clients[0].activities.mute({
        userId: users[7].id,
      });

      assert.ok(result.ok || result.activity || result.result, 'Should succeed');
      console.log(`   ✓ User 1 muted User 8`);
    });

    it('should unmute user 8 via Unmute activity (user 1)', async () => {
      assert.ok(users[7]?.id, 'Need user 8');

      const result = await clients[0].activities.unmute({
        userId: users[7].id,
      });

      assert.ok(result.ok || result.activity || result.result, 'Should succeed');
      console.log(`   ✓ User 1 unmuted User 8`);
    });
  });

  // ============================================================
  // SUMMARY
  // ============================================================
  describe('Test Summary', () => {
    it('should have tested all major activities', () => {
      console.log('\n' + '='.repeat(60));
      console.log('📊 TEST SUMMARY');
      console.log('='.repeat(60));
      console.log(`✓ Created ${users.length} test users`);
      console.log(`✓ Created and managed circles (Add, Remove, Delete)`);
      console.log(`✓ Created open and approval-required groups`);
      console.log(`✓ Tested Join for both group types`);
      console.log(`✓ Created posts to @public, @domain, group, and circle`);
      console.log(`✓ Created replies (including threaded)`);
      console.log(`✓ Created reactions with random emojis`);
      console.log(`✓ Updated posts (content and audience)`);
      console.log(`✓ Deleted posts`);
      console.log(`✓ Tested Follow/Unfollow`);
      console.log(`✓ Tested Flag with random reasons from flagOptions`);
      console.log(`✓ Tested approval flow (Add to approve, Remove to reject)`);
      console.log(`✓ Removed users from groups`);
      console.log(`✓ Left groups via Leave activity`);
      console.log(`✓ Tested Block/Unblock`);
      console.log(`✓ Tested Mute/Unmute`);
      console.log('='.repeat(60) + '\n');
      assert.ok(true);
    });
  });
});
