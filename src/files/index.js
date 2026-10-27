// Files module for Kowloon client
// Handles file uploads, retrieval, and serving

import { ValidationError } from '../utils/errors.js';

/**
 * Files client
 */
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
   * @returns {Promise<Object>} { ok, file: { id, url, thumbnails, metadata } }
   */
  async upload(options) {
    const {
      file, filename, contentType, title, summary,
      to, parentObject, generateThumbnail, thumbnailSizes, onProgress,
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
      const response = await fetch(url, { method: 'POST', headers, body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Upload failed with status ${response.status}`);
      }
      return await response.json();
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      if (typeof onProgress === 'function' && xhr.upload) {
        xhr.upload.onprogress = (event) => {
          const total = event.lengthComputable ? event.total : 0;
          const percent = total > 0 ? Math.round((event.loaded / total) * 100) : 0;
          onProgress({ loaded: event.loaded, total, percent });
        };
      }

      xhr.onload = () => {
        let body = null;
        try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON error body */ }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body);
        } else {
          reject(new Error(body?.error || `Upload failed with status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed: network error'));
      xhr.onabort = () => reject(new Error('Upload cancelled'));

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
   * The server enforces visibility — pass the token as a query param for
   * non-public files (e.g. in an <img src> where you can't set headers).
   * @param {string} fileId - File ID
   * @param {Object} [options]
   * @param {number} [options.size] - Thumbnail size (e.g. 200, 400)
   * @param {string} [options.token] - Auth token (for non-public files in <img src>)
   * @returns {string} Full URL
   */
  serveUrl(fileId, options = {}) {
    if (!fileId) throw new ValidationError('fileId is required');
    const { size, token } = options;
    let url = this.http._buildUrl(`/files/${encodeURIComponent(fileId)}`);
    const params = new URLSearchParams();
    if (size) params.set('size', String(size));
    if (token) params.set('token', token);
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
