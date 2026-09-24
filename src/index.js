// Kowloon Client - Isomorphic JavaScript client for Kowloon
// Works in Node.js, browsers, and React Native

import { HttpClient } from './http/client.js';
import { AuthClient } from './auth/index.js';
import { ActivitiesClient } from './activities/index.js';
import { FeedClient } from './feed/index.js';
import { SearchClient } from './search/index.js';
import { FilesClient } from './files/index.js';
import { NotificationsClient } from './notifications/index.js';
import { ThemesClient } from './themes/index.js';
import { AdminClient } from './admin/index.js';
import { ModerationClient } from './moderation/index.js';
import { OAuthClient } from './oauth/index.js';
import { detectStorage } from './utils/storage.js';

/**
 * Main Kowloon client
 */
export class KowloonClient {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for Kowloon server (e.g., 'https://kwln.org')
   * @param {Object} [options.storage] - Custom storage adapter
   * @param {Object} [options.headers] - Default headers for all requests
   * @param {number} [options.timeout] - Request timeout in ms (default: 30000)
   */
  constructor(options = {}) {
    const { baseUrl, storage, headers, timeout, onUnauthorized } = options;

    if (!baseUrl) {
      throw new Error('baseUrl is required');
    }

    // Storage adapter (auto-detect or custom)
    this.storage = storage || detectStorage();

    // HTTP client
    this.http = new HttpClient({
      baseUrl,
      getToken: () => this.auth.getToken(),
      headers,
      timeout,
      onUnauthorized,
    });

    // Auth client
    this.auth = new AuthClient(this.http, this.storage);

    // Moderation client — the logged-in user's own blocked/muted list, for
    // client-side filtering of anonymously-fetched remote content. Created
    // before activities so block/unblock/mute/unmute can invalidate it.
    this.moderation = new ModerationClient(this.http, this.auth);

    // Files client — instantiated before activities so activities can delegate to it
    this.files = new FilesClient(this.http);

    // Activities client (posts, replies, reacts, circles, groups, bookmarks, pages, user actions)
    this.activities = new ActivitiesClient(this.http, this.files, this.auth, this.moderation);

    // Feed client (content feeds, single object retrieval, collections)
    this.feeds = new FeedClient(this.http);

    // Notifications client
    this.notifications = new NotificationsClient(this.http);

    // Themes client
    this.themes = new ThemesClient(this.http);

    // Search client
    this.search = new SearchClient(this.http);

    // Admin client
    this.admin = new AdminClient(this.http);

    // OAuth client — cross-server identity (see server's routes/oauth/*)
    this.oauth = new OAuthClient(this.http, this.auth);
  }

  /**
   * Initialize client and restore session if available
   * @returns {Promise<Object|null>} User object if session restored, null otherwise
   */
  async init() {
    return await this.auth.restoreSession();
  }
}

// Export everything
export { HttpClient } from './http/client.js';
export { AuthClient } from './auth/index.js';
export { ActivitiesClient } from './activities/index.js';
export { FeedClient } from './feed/index.js';
export { SearchClient } from './search/index.js';
export { FilesClient } from './files/index.js';
export { NotificationsClient } from './notifications/index.js';
export { ThemesClient } from './themes/index.js';
export { AdminClient } from './admin/index.js';
export { ModerationClient } from './moderation/index.js';
export { OAuthClient } from './oauth/index.js';
export * from './prefs/manifest.js';
export * from './prefs/pins.js';
export * from './embeds/index.js';
export * from './utils/kowloonId.js';
export * from './utils/errors.js';
export * from './utils/storage.js';
export * from './utils/timeAgo.js';

export default KowloonClient;
