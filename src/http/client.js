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
      // wakes from sleep: the page and its JS are already alive, but the OS
      // network interface hasn't finished reconnecting yet, so the very next
      // request fails even though a retry moments later succeeds fine. Safe
      // to retry blindly here specifically because the request never reached
      // the server in this failure mode, and every mutating endpoint in this
      // client is idempotent (react/outbox activities upsert, never duplicate).
      if (error.isTransientNetworkError) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return this._fetchOnce(url, options);
      }
      throw error;
    }
  }

  /**
   * Single fetch attempt with timeout handling. @private
   */
  async _fetchOnce(url, options = {}) {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error.name === 'AbortError') {
        throw new NetworkError('Request timeout', {
          url,
          timeout: this.timeout,
        });
      }

      // Handle network errors -- flagged for one retry by _fetch() above.
      const networkError = new NetworkError(error.message, {
        url,
        originalError: error,
      });
      networkError.isTransientNetworkError = true;
      throw networkError;
    }
  }

  /**
   * Parse response body
   * @private
   */
  async _parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        return await response.json();
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
  async _handleResponse(response, url, options) {
    const body = await this._parseResponse(response);

    if (!response.ok) {
      const errorMessage = body?.error || body?.message || response.statusText || 'Request failed';

      // Session expired: a request that sent a token got 401 back. Notify the
      // host so it can log out + redirect, rather than showing a raw error while
      // the UI still thinks it's logged in (#57). Only fire when a token was
      // actually attached — an anonymous 401 is a normal "please log in" case.
      if (response.status === 401 && options?.headers?.Authorization && this.onUnauthorized) {
        try { this.onUnauthorized(); } catch { /* never let the hook mask the error */ }
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
   * @returns {Promise<any>}
   */
  async request(method, path, options = {}) {
    const { body, headers: customHeaders, params } = options;

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

    // Make request
    const response = await this._fetch(url, fetchOptions);

    // Handle response
    return await this._handleResponse(response, url, fetchOptions);
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
