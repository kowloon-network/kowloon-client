# Kowloon Client

Isomorphic JavaScript client library for the Kowloon federated social media server. Works in Node.js, browsers, and React Native.

## Architecture

### Module Structure

```
src/
  index.js               — Main KowloonClient class, wires everything together
  http/client.js         — HttpClient (fetch wrapper with JWT injection, timeout, error mapping)
  auth/index.js          — AuthClient (register, login, logout, session management)
  activities/index.js    — ActivitiesClient (write ops: posts, replies, reacts, circles, groups, bookmarks, pages, user actions)
  feed/index.js          — FeedClient (read ops: content feeds, single objects, collections, files)
  search/index.js        — SearchClient (search: posts, pages, groups, users, bookmarks)
  files/index.js         — FilesClient (upload, list, getMeta, serveUrl, delete)
  notifications/index.js — NotificationsClient (list, unreadCount, markRead, markUnread, markAllRead, dismiss)
  admin/index.js         — AdminClient (CRUD for all types, settings, moderation) — also on client.admin, see below
  moderation/index.js    — ModerationClient (client-side block/mute filtering for anonymous cross-server views)
  oauth/index.js         — OAuthClient (cross-server "visiting" identity; see server routes/oauth/*)
  embeds/index.js        — resolveEmbed()/isEmbeddable() registry (YouTube, etc.) shared with web + mobile
  prefs/manifest.js      — PREF_GROUPS/PREFS — shared source of truth for settings UIs (web + mobile)
  prefs/pins.js          — pin/unpin/togglePin/sortByPins — feed-selector pin helpers
  themes/index.js        — ThemesClient (list/getById public; create/update/delete/setDefault admin-only)
  utils/errors.js        — Error classes (KowloonError, AuthenticationError, ValidationError, etc.)
  utils/storage.js       — Auto-detect storage adapter (localStorage, AsyncStorage, in-memory)
```

### Key Design Decisions — DO NOT CHANGE

- **All methods take options objects** (not positional args): `client.feeds.getPost({ postId: "..." })`
- **Follow = circles** — Kowloon has no follow graph; `addToCircle`/`removeFromCircle` IS the follow. `activities.follow({ userId })`/`unfollow({ userId })` exist as convenience wrappers that add/remove the user in the caller's own Following circle.
- **Reply is separate from Post** on the server. `createReply` sends `{ type: "Reply", objectType: "Reply", to: parentPostId }`.
- **React is separate** too. `react` sends `{ type: "React", objectType: "React", to: targetId }`.
- **Notifications are in NotificationsClient** — not in FeedClient.
- **Files are in FilesClient** — `activities.upload()` delegates to `files.upload()`.
- **Admin is available both ways** — `client.admin` on every normal `KowloonClient` instance, and also as a separate package export: `import { AdminClient } from '@kowloon/client/admin'`
- **Profile updates are Activities** — `updateProfile()` posts to outbox with `type: "Update"`

### Client Initialization

```js
import KowloonClient from '@kowloon/client';

const client = new KowloonClient({ baseUrl: 'https://kwln.org' });
await client.init(); // restores session if available

// Sub-clients:
client.auth           // AuthClient
client.activities     // ActivitiesClient
client.feeds          // FeedClient (note: plural)
client.files          // FilesClient
client.notifications  // NotificationsClient
client.search         // SearchClient
```

### Write Operations (ActivitiesClient)

All write operations go through `POST /outbox`.

Methods: createPost, updatePost, deletePost, createReply, react, follow, unfollow, createActivity, createCircle, updateCircle, deleteCircle, addToCircle, removeFromCircle, createGroup, updateGroup, deleteGroup, joinGroup, leaveGroup, approveJoinRequest, rejectJoinRequest, createBookmark, updateBookmark, deleteBookmark, createPage, updatePage, deletePage, updateProfile, block, unblock, mute, unmute, flag, upload (delegates to FilesClient)

There is no `deleteReact()` — the server has no way to receive an "undo a reaction" request by ID (`Undo` requires the full original activity, not a target ID). To clear a reaction, call `react({ postId, emoji: '' })` — an empty/omitted emoji clears the existing reaction (see React's set/clear behavior below).

`rejectJoinRequest({ groupId, userId })` sends `{ type: 'Remove', to: groupId, object: userId }` — there is no dedicated "Reject" activity type. The server's `Remove` handler already falls back to the group's Pending circle when the target isn't found in Members, which is exactly what rejecting a pending request means. This mirrors `approveJoinRequest`'s `Add`-based pattern.

### Read Operations (FeedClient)

All read operations are GET requests.

Content feeds: getServerPosts, getServerPages, getCirclePosts, getGroupPosts, getUserPosts
Single objects: getPost, getGroup, getUser, getBookmark, getPage, getCircle
Collections: getGroupMembers, getCircleMembers, getUserCircles, getUserBookmarks, getReplies, getReacts
Files: getFile (metadata at `/files/:id/meta`)

### Files (FilesClient)

- `upload(options)` — `POST /files` multipart. Accepts `to`, `parentObject`, `generateThumbnail`, `thumbnailSizes`.
- `list(options)` — `GET /files` (authenticated user's files)
- `getMeta(fileId)` — `GET /files/:id/meta`
- `serveUrl(fileId, { size? })` — builds URL for `<img src>` etc. (not an HTTP call). No `token` option (JWTs don't belong in URLs).
- `delete(fileId)` — `DELETE /files/:id`

Files are served at `GET /files/:id` (auth-controlled proxy). Thumbnails: `?size=200`.
Visibility inherited from parent object at serve time if `parentObject` is set.

### Notifications (NotificationsClient)

- `list(options)` — `GET /notifications`
- `unreadCount(options)` — `GET /notifications/unread/count`
- `markRead(id)` — `POST /notifications/:id/read`
- `markUnread(id)` — `POST /notifications/:id/unread`
- `markAllRead(options)` — `POST /notifications/read-all`
- `dismiss(id)` — `POST /notifications/:id/dismiss`

### Search (SearchClient)

Searchable types: **posts, pages, groups, users, bookmarks** (not circles, activities, or notifications).

General: `search({ query, searchIn: { posts: true, users: true } })`
Convenience: searchPosts, searchPages, searchGroups, searchUsers, searchBookmarks

### Error Handling

HttpClient maps HTTP status codes to typed errors:
- 401 → AuthenticationError
- 403 → AuthorizationError
- 404 → NotFoundError
- 400-499 → ValidationError
- 500+ → ServerError
- Network failures → NetworkError

All extend KowloonError with `statusCode`, `response`, `requestId`.

## Test Status (as of 2026-03-09)

All 116 tests passing: `node --test tests/*.test.js`

Run with: `KOWLOON_BASE_URL=http://kwln1.local:8080 BASE_URL=http://kwln1.local:8080 node --test tests/*.test.js`
(integration.test.js requires seeded data via seed-test.js, reads `BASE_URL` env var)

### Key API notes confirmed by tests
- `updatePost`: `updates.content` wraps to `object.source = { content }` (server stores `source.content`)
- `updatePost`: `updates.to`/`canReply`/`canReact` go into `object`, not activity-level (Update handler reads from object patch)
- `reply()` stores parent ID in result's `target` field (not `inReplyTo`)
- `react()` returns `{ status: 'reacted', react, bumped }` (no id — upsert model)
- `follow()`/`unfollow()` use `auth._user.following` (flat field from login, not nested under `circles`)
- `addToCircle()`/`removeFromCircle()` accept `userId` as alias for `memberId`
- `createGroup()` accepts `rsvpPolicy` directly (alias for `membershipPolicy`)
- Notifications are on `client.notifications.*`, not `client.feeds.*`

## Related Project

The server is at `../server/`. See its CLAUDE.md for server architecture, schema details, and route patterns.

## Consolidated API Spec

The full spec is in Joplin (note ID: 1cfd6eaee9b64494a577617d4f9e5847). Read with:
```
curl "http://localhost:41184/notes/1cfd6eaee9b64494a577617d4f9e5847?token=$JOPLIN_TOKEN&fields=body"
```
