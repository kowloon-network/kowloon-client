// Isomorphic HTTP client using native fetch
// Works in Node.js 18+, browsers, and React Native

import { createErrorFromStatus, NetworkError } from '../utils/errors.js';

/**
 * HTTP client for Kowloon API
 */
export class HttpClient {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API (e.g., 'https://kowloon.org')
   * @param {Function} options.getToken - Async function to get current auth token
   * @param {Object} options.headers - Default headers
   * @param {number} options.timeout - Request timeout in ms (default: 30000)
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.getToken = options.getToken || (() => null);
    this.defaultHeaders = options.headers || {};
    this.timeout = options.timeout || 30000;
    // Called when a request that CARRIED a token still comes back 401 — i.e. the
    // session expired. Lets the host app clear stale auth and send the user to
    // login instead of surfacing a raw "Authentication required" error.
    this.onUnauthorized = options.onUnauthorized || null;
    // Set by KowloonClient: clears the stored token when the server rejects
    // it. Resolves false if the rejected token is no longer the current one
    // (user re-logged in while the request was in flight) -- then we don't
    // treat it as a session expiry.
    this.onTokenInvalid = options.onTokenInvalid || null;
    // Last token we fired onUnauthorized for, so a burst of parallel 401s
    // (feed + notifications + ...) triggers one logout, not a storm.
    this._unauthorizedFiredFor = null;
  }

  /**
   * A request that carried `token` came back 401: clear that token and fire
   * onUnauthorized -- at most once per token. Also used by the XHR/fetch
   * upload paths in files/admin, which bypass request().
   * @param {string} token - The token that was rejected
   */
  async notifyUnauthorized(token) {
    if (!token || token === this._unauthorizedFiredFor) return;
    this._unauthorizedFiredFor = token;
    let current = true;
    if (this.onTokenInvalid) {
      try { current = (await this.onTokenInvalid(token)) !== false; } catch { /* ignore */ }
    }
    if (current && this.onUnauthorized) {
      try { this.onUnauthorized(); } catch { /* never let the hook mask the error */ }
    }
  }

  /**
   * Shared handling for raw (non-request()) calls such as multipart uploads:
   * parse a response body the same way for fetch and XHR -- JSON if it
   * parses, else the raw text (null if empty).
   * @param {string} text
   * @returns {any}
   */
  parseRawBody(text) {
    if (text == null || text === '') return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  /**
   * Build a typed KowloonError (statusCode etc.) for a failed raw call, and
   * run the session-expiry path for a 401 on a token-carrying request.
   * @param {number} status
   * @param {any} body - Parsed body (see parseRawBody)
   * @param {Object} info - { url, method, token, fallback }
   * @returns {Promise<KowloonError>}
   */
  async rawResponseError(status, body, { url, method = 'POST', token, fallback = 'Request failed' } = {}) {
    if (status === 401 && token) await this.notifyUnauthorized(token);
    const message = (body && typeof body === 'object' && (body.error || body.message))
      || `${fallback} with status ${status}`;
    return createErrorFromStatus(status, message, { response: body, statusCode: status, url, method });
  }

  /**
   * Build full URL from path
   * @private
   */
  _buildUrl(path) {
    const base = this.baseUrl.replace(/\/$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }

  /**
   * Build headers for request
   * @private
   */
  async _buildHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...this.defaultHeaders,
      ...customHeaders,
    };

    // Add auth token if available
    const token = await this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Make HTTP request with timeout and error handling
   * @private
   */
  async _fetch(url, options = {}) {
    try {
      return await this._fetchOnce(url, options);
    } catch (error) {
      // One silent retry for a genuine network-layer failure (the browser's
      // fetch() throwing before any response arrived -- "Failed to fetch"),
      // NOT for a timeout/abort. This is the common case right after a laptop
      // wakes from sleep: the OS network interface hasn't finished
      // reconnecting, so the next request fails though a retry moments later
      // succeeds. A thrown fetch() does NOT prove the request never reached
      // the server (the connection can drop after the body was sent), and
      // many POSTs are not idempotent (register, changePassword,
      // deleteAccount, createCircle...). So only retry when a duplicate is
      // harmless: safe methods (GET/HEAD), or a POST carrying a `dedupeKey`
      // the server uses to collapse duplicates.
      if (error.isTransientNetworkError && this._isRetrySafe(options)) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return this._fetchOnce(url, options);
      }
      throw error;
    }
  }

  /**
   * Whether a request may be transparently re-sent. @private
   */
  _isRetrySafe(options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD') return true;
    if (method !== 'POST' || typeof options.body !== 'string') return false;
    try {
      const parsed = JSON.parse(options.body);
      return !!(parsed && (parsed.dedupeKey || parsed.object?.dedupeKey));
    } catch {
      return false;
    }
  }

  /**
   * Single fetch attempt with timeout handling. @private
   * Returns { response, clear }: the timeout stays armed until the caller
   * calls clear() after reading the body, so a server that sends headers
   * then stalls mid-body still times out. options.signal (caller's own
   * AbortSignal) is combined with the timeout.
   */
  async _fetchOnce(url, options = {}) {
    const { signal: callerSignal, ...fetchOpts } = options;
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeout);
    let unlink = () => {};
    let signal = controller.signal;
    if (callerSignal) {
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
        signal = AbortSignal.any([controller.signal, callerSignal]);
      } else {
        // Older runtimes (RN/Hermes, Node < 20): forward the abort by hand.
        const forward = () => controller.abort();
        if (callerSignal.aborted) controller.abort();
        else callerSignal.addEventListener('abort', forward, { once: true });
        unlink = () => callerSignal.removeEventListener('abort', forward);
      }
    }
    const clear = () => { clearTimeout(timeoutId); unlink(); };

    try {
      const response = await fetch(url, { ...fetchOpts, signal });
      return { response, clear, isTimeout: () => timedOut };
    } catch (error) {
      clear();
      throw this._mapFetchError(error, url, timedOut, callerSignal);
    }
  }

  /**
   * Map a thrown fetch/body-read error. @private
   */
  _mapFetchError(error, url, timedOut, callerSignal) {
    if (error?.name === 'AbortError' || timedOut || callerSignal?.aborted) {
      // Caller-initiated abort: surface the AbortError as-is so callers can
      // check err.name === 'AbortError'. Never retried.
      if (callerSignal?.aborted && !timedOut) return error;
      return new NetworkError('Request timeout', { url, timeout: this.timeout });
    }
    // Network errors -- flagged as retry-eligible; _fetch() decides whether
    // this particular request is safe to re-send.
    const networkError = new NetworkError(error.message, { url, originalError: error });
    networkError.isTransientNetworkError = true;
    return networkError;
  }

  /**
   * Parse response body
   * @private
   */
  async _parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      // Read as text first so a timeout/abort during the body read throws
      // (mapped by request()) instead of looking like invalid JSON -> null.
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        // Invalid JSON
        return null;
      }
    }

    // Return text for non-JSON responses
    return await response.text();
  }

  /**
   * Handle HTTP response and errors
   * @private
   */
  async _handleResponse(response, url, options, body) {
    if (body === undefined) body = await this._parseResponse(response);

    if (!response.ok) {
      const errorMessage = body?.error || body?.message || response.statusText || 'Request failed';

      // Session expired: a request that sent a token got 401 back. Notify the
      // host so it can log out + redirect, rather than showing a raw error while
      // the UI still thinks it's logged in (#57). Only fire when a token was
      // actually attached — an anonymous 401 is a normal "please log in" case.
      // Clears the rejected token and fires once per token (see notifyUnauthorized).
      const auth = options?.headers?.Authorization;
      if (response.status === 401 && typeof auth === 'string' && auth.startsWith('Bearer ')) {
        await this.notifyUnauthorized(auth.slice(7));
      }

      throw createErrorFromStatus(response.status, errorMessage, {
        response: body,
        statusCode: response.status,
        url,
        method: options.method,
      });
    }

    return body;
  }

  /**
   * Make a request
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} options
   * @param {Object} options.body - Request body (will be JSON stringified)
   * @param {Object} options.headers - Custom headers
   * @param {Object} options.params - Query parameters
   * @param {AbortSignal} [options.signal] - Caller abort signal (combined with the timeout)
   * @returns {Promise<any>}
   */
  async request(method, path, options = {}) {
    const { body, headers: customHeaders, params, signal } = options;

    // Build URL with query params
    let url = this._buildUrl(path);
    if (params) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query.append(key, String(value));
        }
      });
      const queryString = query.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    // Build headers
    const headers = await this._buildHeaders(customHeaders);

    // Build fetch options
    const fetchOptions = {
      method: method.toUpperCase(),
      headers,
    };

    // Add body if present
    if (body !== undefined) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    // Make request. The timeout covers the body read too -- cleared only
    // once the body is parsed.
    const { response, clear, isTimeout } = await this._fetch(url, { ...fetchOptions, signal });
    let parsed;
    try {
      parsed = await this._parseResponse(response);
    } catch (error) {
      throw this._mapFetchError(error, url, isTimeout(), signal);
    } finally {
      clear();
    }

    // Handle response
    return await this._handleResponse(response, url, fetchOptions, parsed);
  }

  /**
   * GET request
   */
  async get(path, options = {}) {
    return this.request('GET', path, options);
  }

  /**
   * POST request
   */
  async post(path, body, options = {}) {
    return this.request('POST', path, { ...options, body });
  }

  /**
   * PUT request
   */
  async put(path, body, options = {}) {
    return this.request('PUT', path, { ...options, body });
  }

  /**
   * PATCH request
   */
  async patch(path, body, options = {}) {
    return this.request('PATCH', path, { ...options, body });
  }

  /**
   * DELETE request
   */
  async delete(path, options = {}) {
    return this.request('DELETE', path, options);
  }
}

export default HttpClient;
