// Authentication module for Kowloon client

import { getToken, setToken, removeToken } from '../utils/storage.js';
import { AuthenticationError } from '../utils/errors.js';

/**
 * Authentication client
 */
export class AuthClient {
  /**
   * @param {HttpClient} http - HTTP client instance
   * @param {Object} storage - Optional custom storage adapter
   */
  constructor(http, storage = null) {
    this.http = http;
    this.storage = storage;
    this._user = null;
    this._token = null;
  }

  /**
   * Get current auth token
   * @returns {Promise<string|null>}
   */
  async getToken() {
    if (this._token) return this._token;
    this._token = await getToken('kowloon_token', this.storage);
    return this._token;
  }

  /**
   * Get current user
   * @returns {Object|null}
   */
  getUser() {
    return this._user;
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    return !!(await this.getToken());
  }

  /**
   * Register a new user. Kowloon has no server-wide open-signup switch — every
   * registration requires a valid invite code, individual or an admin-issued
   * "open" link (which can itself be unlimited-redemption).
   * @param {Object} credentials
   * @param {string} credentials.username - Username
   * @param {string} credentials.password - Password
   * @param {string} credentials.inviteCode - Invite code (always required)
   * @param {string} [credentials.email] - Email (optional)
   * @param {Object} [credentials.profile] - Profile data (optional)
   * @param {string[]} [credentials.acknowledgedRules] - IDs of every server rule the user ticked off
   * @returns {Promise<Object>} { user, token }
   */
  async register(credentials) {
    const { username, password, email, profile, inviteCode, acknowledgedRules } = credentials;

    if (!username || !password) {
      throw new AuthenticationError('Username and password are required');
    }
    if (!inviteCode) {
      throw new AuthenticationError('An invite code is required to register');
    }

    const response = await this.http.post('/register', {
      username,
      password,
      email,
      profile,
      inviteCode,
      acknowledgedRules,
    });

    if (!response.token) {
      throw new AuthenticationError('Registration failed - no token received');
    }

    // Store token and user
    this._token = response.token;
    this._user = response.user;
    await setToken(this._token, 'kowloon_token', this.storage);

    return {
      user: this._user,
      token: this._token,
    };
  }

  /**
   * Login with username and password
   * @param {Object} credentials
   * @param {string} [credentials.username] - Username
   * @param {string} [credentials.id] - User ID (@user@domain)
   * @param {string} credentials.password - Password
   * @returns {Promise<Object>} { user, token }
   */
  async login(credentials) {
    const { username, id, password } = credentials;

    if ((!username && !id) || !password) {
      throw new AuthenticationError('Username/ID and password are required');
    }

    const response = await this.http.post('/auth/login', {
      username,
      id,
      password,
    });

    if (!response.token) {
      throw new AuthenticationError('Login failed - no token received');
    }

    // Store token and user
    this._token = response.token;
    this._user = response.user;
    await setToken(this._token, 'kowloon_token', this.storage);

    return {
      user: this._user,
      token: this._token,
    };
  }

  /**
   * Adopt an already-issued token + user (e.g. a visiting session token
   * returned by client.oauth.exchange()) without hitting /auth/login.
   * @param {string} token
   * @param {Object} user
   * @returns {Promise<void>}
   */
  async setSession(token, user) {
    this._token = token;
    this._user = user;
    await setToken(this._token, 'kowloon_token', this.storage);
  }

  /**
   * Logout (clear token and user)
   * @returns {Promise<void>}
   */
  async logout() {
    this._token = null;
    this._user = null;
    await removeToken('kowloon_token', this.storage);
  }

  /**
   * Restore session from stored token
   * @returns {Promise<Object|null>} User object if session restored, null otherwise
   */
  async restoreSession() {
    const token = await this.getToken();
    if (!token) return null;

    try {
      const payload = this._decodeToken(token);
      this._user = payload.user || null;
      if (!this._user?.id) {
        await this.logout();
        return null;
      }
      // Fetch fresh profile/prefs/admin flag so stale JWT snapshot doesn't linger.
      // isServerAdmin and the user's system-circle IDs (following, groups,
      // etc.) are not in the JWT payload — only /auth/me carries them.
      try {
        const fresh = await this.http.get('/auth/me');
        const freshUser = fresh?.user;
        if (freshUser?.id) {
          this._user = {
            ...this._user,
            profile: freshUser.profile ?? this._user.profile,
            prefs: freshUser.prefs ?? this._user.prefs,
            isServerAdmin: !!freshUser.isServerAdmin,
            following: freshUser.following ?? this._user.following,
            allFollowing: freshUser.allFollowing ?? this._user.allFollowing,
            blocked: freshUser.blocked ?? this._user.blocked,
            muted: freshUser.muted ?? this._user.muted,
            groups: freshUser.groups ?? this._user.groups,
          };
        }
      } catch {
        // Non-fatal — keep the decoded snapshot if the refresh fails
      }
      return this._user;
    } catch (e) {
      // Invalid token, clear it
      await this.logout();
      return null;
    }
  }

  /**
   * Change the logged-in user's password.
   * Returns a fresh token, which replaces the stored one so the current
   * session survives the change. Other existing sessions are NOT signed out —
   * tokens are stateless and stay valid until they expire.
   * @param {Object} passwords
   * @param {string} passwords.currentPassword
   * @param {string} passwords.newPassword
   * @returns {Promise<{ok: boolean, token: string}>}
   */
  async changePassword({ currentPassword, newPassword } = {}) {
    if (!currentPassword || !newPassword) {
      throw new AuthenticationError(
        'Current password and new password are required'
      );
    }

    const response = await this.http.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });

    if (response?.token) {
      this._token = response.token;
      await setToken(this._token, 'kowloon_token', this.storage);
    }

    return response;
  }

  /**
   * Decode JWT token (client-side only, does NOT verify signature)
   * @private
   * @param {string} token - JWT token
   * @returns {Object} Decoded payload
   */
  _decodeToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token format');

      // JWTs use base64url — normalize to standard base64 before decoding
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';

      const decoded = JSON.parse(
        typeof Buffer !== 'undefined'
          ? Buffer.from(b64, 'base64').toString('utf8')
          : atob(b64)
      );

      return decoded;
    } catch (e) {
      throw new AuthenticationError('Failed to decode token');
    }
  }
}

export default AuthClient;
