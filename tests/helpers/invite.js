// tests/helpers/invite.js
// Registration always requires an invite code now (no server-wide open-signup
// switch) — mints one unlimited-redemption "open" invite via the server's
// first-boot admin account, for a test file's register() calls to share.
//
// ADMIN_USERNAME/ADMIN_PASSWORD match the env vars an install sets on first
// boot (see kowloon/server's config), defaulting to what .env.example ships.

import { KowloonClient } from '../../src/index.js';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

export async function getTestInviteCode(baseUrl) {
  const admin = new KowloonClient({ baseUrl });
  await admin.auth.login({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  const { invite } = await admin.admin.createInvite({
    type: 'open',
    note: 'client SDK test suite',
  });
  return invite.code;
}
