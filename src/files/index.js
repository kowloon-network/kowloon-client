// Files module for Kowloon client
// Handles file uploads, retrieval, and serving

import { ValidationError, NetworkError } from '../utils/errors.js';

// Uploads can be large and slow (mobile video on a weak connection), so they
// get their own generous timeout instead of HttpClient's 30s default.
const DEFAULT_UPLOAD_TIMEOUT = 10 * 60 * 1000;

/**
 * Files client
 */
// Same shape fetch() uses for an aborted request, so callers can check
// err.name === 'AbortError' regardless of runtime/path.
function abortError(message = 'Upload aborted') {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

export class FilesClient {
  /**
   * @param {HttpClient} http - HTTP client instance
   */
  constructor(http) {
    this.http = http;
  }

  /**
   * Upload a file
   * @param {Object} options
   * @param {Buffer|Blob} options.file - File data
   * @param {string} options.filename - Original filename
   * @param {string} [options.contentType] - MIME type
   * @param {string} [options.title] - Display name
   * @param {string} [options.summary] - Alt text / description
   * @param {string} [options.to] - Visibility (default '@public')
   * @param {string} [options.parentObject] - Parent object ID (post/page/etc) — inherits that object's visibility at serve time
   * @param {boolean} [options.generateThumbnail] - Generate thumbnails (for images)
   * @param {number[]} [options.thumbnailSizes] - Thumbnail sizes in px (default [200, 400])
   * @param {(progress: { loaded: number, total: number, percent: number }) => void} [options.onProgress] -
   *   Upload progress callback. Fired repeatedly as bytes go out over the wire.
   *   `total` is 0 (and `percent` is 0) if the browser/runtime can't report a
   *   content length for this body — treat that as "no progress available"
   *   rather than "0% forever".
   * @param {AbortSignal} [options.signal] - Abort the upload (rejects with an AbortError)
   * @param {number} [options.timeout] - Upload timeout in ms (default 10 minutes)
   * @returns {Promise<Object>} { ok, file: { id, url, thumbnails, metadata } }
   */
  async upload(options) {
    const {
      file, filename, contentType, title, summary,
      to, parentObject, generateThumbnail, thumbnailSizes, onProgress,
      signal, timeout = DEFAULT_UPLOAD_TIMEOUT,
    } = options;

    if (!file) throw new ValidationError('file is required for upload');
    if (!filename) throw new ValidationError('filename is required for upload');

    const formData = new FormData();

    if (typeof Blob !== 'undefined' && file instanceof Blob) {
      formData.append('file', file, filename);
    } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(file)) {
      formData.append('file', new Blob([file], { type: contentType }), filename);
    } else {
      formData.append('file', file, filename);
    }

    if (title) formData.append('title', title);
    if (summary) formData.append('summary', summary);
    if (to) formData.append('to', to);
    if (parentObject) formData.append('parentObject', parentObject);
    if (generateThumbnail) formData.append('generateThumbnail', 'true');
    if (thumbnailSizes) formData.append('thumbnailSizes', JSON.stringify(thumbnailSizes));

    const token = await this.http.getToken();
    const url = this.http._buildUrl('/files/');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // XMLHttpRequest, not fetch(): fetch() has no upload-progress event in
    // any runtime (browser or React Native) -- XHR's upload.onprogress is
    // the only way to report real bytes-sent progress on either platform
    // with one code path (#69, progress-reporting slice only; chunked
    // resume and mobile background-upload resilience are separate, bigger
    // pieces of that issue needing their own design work before they're
    // built -- not done here). Node has no global XMLHttpRequest (this
    // client is also used from plain Node scripts, e.g. seed-group-images.js)
    // so fall back to the original fetch() path there -- no progress
    // reporting in that environment, which is fine, nothing there needs it.
    if (typeof XMLHttpRequest === 'undefined') {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);
      const forward = () => controller.abort();
      if (signal?.aborted) controller.abort();
      else signal?.addEventListener?.('abort', forward, { once: true });
      try {
        const response = await fetch(url, { method: 'POST', headers, body: formData, signal: controller.signal });
        const body = this.http.parseRawBody(await response.text());
        if (!response.ok) {
          throw await this.http.rawResponseError(response.status, body, { url, token, fallback: 'Upload failed' });
        }
        return body;
      } catch (err) {
        if (timedOut) throw new NetworkError('Upload timed out', { url, timeout });
        if (err?.name === 'AbortError') throw err;
        if (err?.statusCode) throw err;
        throw new NetworkError(`Upload failed: ${err?.message || 'network error'}`, { url, originalError: err });
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener?.('abort', forward);
      }
    }

    if (signal?.aborted) throw abortError();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.timeout = timeout;

      const onAbortSignal = () => xhr.abort();
      signal?.addEventListener?.('abort', onAbortSignal, { once: true });
      const cleanup = () => signal?.removeEventListener?.('abort', onAbortSignal);

      if (typeof onProgress === 'function' && xhr.upload) {
        xhr.upload.onprogress = (event) => {
          const total = event.lengthComputable ? event.total : 0;
          const percent = total > 0 ? Math.round((event.loaded / total) * 100) : 0;
          onProgress({ loaded: event.loaded, total, percent });
        };
      }

      xhr.onload = async () => {
        cleanup();
        const body = this.http.parseRawBody(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body);
        } else {
          reject(await this.http.rawResponseError(xhr.status, body, { url, token, fallback: 'Upload failed' }));
        }
      };
      xhr.onerror = () => { cleanup(); reject(new NetworkError('Upload failed: network error', { url })); };
      xhr.ontimeout = () => { cleanup(); reject(new NetworkError('Upload timed out', { url, timeout })); };
      xhr.onabort = () => { cleanup(); reject(abortError('Upload cancelled')); };

      xhr.send(formData);
    });
  }

  /**
   * List the authenticated user's files
   * @param {Object} [options]
   * @param {string} [options.type] - Filter by type (Image, Video, Audio, Document)
   * @param {number} [options.page]
   * @param {number} [options.limit]
   * @returns {Promise<Object>} { ok, files, total, page, limit }
   */
  async list(options = {}) {
    const { type, page, limit } = options;
    const params = {};
    if (type) params.type = type;
    if (page) params.page = page;
    if (limit) params.limit = limit;
    return await this.http.get('/files', { params });
  }

  /**
   * Get file metadata
   * @param {string} fileId - File ID (e.g. 'file:abc123@domain')
   * @returns {Promise<Object>} File metadata
   */
  async getMeta(fileId) {
    if (!fileId) throw new ValidationError('fileId is required');
    return await this.http.get(`/files/${encodeURIComponent(fileId)}/meta`);
  }

  /**
   * Build the URL for serving a file (for use in <img src> etc.)
   * The server enforces visibility. (No `token` option: putting a JWT in a
   * URL leaks it into logs/history/Referer; restricted media uses
   * server-issued signed URLs instead.)
   * @param {string} fileId - File ID
   * @param {Object} [options]
   * @param {number} [options.size] - Thumbnail size (e.g. 200, 400)
   * @returns {string} Full URL
   */
  serveUrl(fileId, options = {}) {
    if (!fileId) throw new ValidationError('fileId is required');
    const { size } = options;
    let url = this.http._buildUrl(`/files/${encodeURIComponent(fileId)}`);
    const params = new URLSearchParams();
    if (size) params.set('size', String(size));
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }

  /**
   * Delete a file (owner or server admin only)
   * @param {string} fileId - File ID (e.g. 'file:abc123@domain')
   * @returns {Promise<Object>} { ok, deleted, id }
   */
  async delete(fileId) {
    if (!fileId) throw new ValidationError('fileId is required');
    return await this.http.delete(`/files/${encodeURIComponent(fileId)}`);
  }
}

export default FilesClient;
