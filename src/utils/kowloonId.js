// src/utils/kowloonId.js
// Classify a piece of user-typed text as a Kowloon id, handle, or link — the
// client-side counterpart of the server's methods/parse/kowloonId.js. Kept
// in sync with it by hand (no shared package between the two repos), but the
// logic is small and stable: it's whole-string pattern matching, nothing
// that touches the network or the database.
//
// Used to power "paste an ID/handle/link, jump straight there" in the web
// and mobile search screens — see parseKowloonId() below.

const ALLOWED_URL_SCHEMES = new Set(['http', 'https']);

function isWebUrl(str) {
  const s = String(str || '').trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return false; // must have ://
  try {
    const u = new URL(s);
    return ALLOWED_URL_SCHEMES.has(u.protocol.replace(':', '').toLowerCase());
  } catch {
    return false;
  }
}

const TYPE_MAP = {
  post: 'Post',
  reply: 'Reply',
  react: 'React',
  group: 'Group',
  circle: 'Circle',
  page: 'Page',
  bookmark: 'Bookmark',
  user: 'User',
};

// Types that have a real "view this" destination in the web/mobile apps
// today. Reply and React only ever render inline on their parent post, and
// Bookmark is a personal, non-shareable list item — none of the three have a
// standalone page on either platform. Kept here (rather than only in each
// app's UI layer) so both apps agree on the answer without duplicating it.
export const NAVIGABLE_TYPES = new Set([
  'User',
  'Post',
  'Circle',
  'Group',
  'Page',
  'Server',
]);

/**
 * Classify `raw` as one of: a Kowloon User id (@user@domain), a bare-domain
 * Server reference (@domain), a typed object id (kind:local@domain), a web
 * URL, or Unknown (plain search text — not a recognized shape at all).
 *
 * This is a pure string classifier — it never guesses whether the object
 * actually exists or whether the viewer can see it. Existence + visibility
 * are only ever resolved by an actual GET /lookup (or, for Server, GET
 * /servers/:domain) call, never inferred here.
 *
 * @param {string} raw
 * @returns {{type: string, domain: string|null, userId: string|null}}
 *   type is one of "User" | "Server" | "URL" | "Unknown" | a TYPE_MAP value
 *   ("Post", "Reply", "React", "Group", "Circle", "Page", "Bookmark").
 */
export function parseKowloonId(raw) {
  const id = String(raw || '').trim();
  if (!id) return { type: 'Unknown', domain: null, userId: null };

  // 1) Only http/https with :// count as URL.
  if (isWebUrl(id)) {
    const u = new URL(id);
    return { type: 'URL', domain: u.hostname || null, userId: null };
  }

  // 2) User ids: "@user@domain" or server shorthand "@domain".
  if (id.startsWith('@')) {
    const parts = id.split('@').filter(Boolean);
    if (parts.length === 2) return { type: 'User', domain: parts[1], userId: id };
    if (parts.length === 1) return { type: 'Server', domain: parts[0], userId: null };
    return { type: 'User', domain: parts.at(-1) || null, userId: id };
  }

  // 3) Object ids: "kind:local@domain".
  const m = id.match(/^([a-z][a-z0-9_-]*):([^@]+)@([^/\s]+)$/i);
  if (m) {
    const kind = (m[1] || '').toLowerCase();
    const domain = m[3] || null;
    const type = TYPE_MAP[kind] || (kind ? kind[0].toUpperCase() + kind.slice(1) : kind);
    return { type, domain, userId: null };
  }

  return { type: 'Unknown', domain: null, userId: null };
}

/** Convenience: does this string look like anything parseKowloonId recognizes? */
export function isKowloonId(raw) {
  return parseKowloonId(raw).type !== 'Unknown';
}

/** Convenience: does this string look like something the app can navigate to? */
export function isNavigableKowloonId(raw) {
  return NAVIGABLE_TYPES.has(parseKowloonId(raw).type);
}
