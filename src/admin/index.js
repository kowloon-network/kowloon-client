// Admin module for Kowloon client
// Separate import: import { AdminClient } from 'kowloon-client/admin'
// Requires server admin or moderator role.

import { ValidationError } from '../utils/errors.js';

/**
 * Admin client — all methods hit /admin/* endpoints
 * Bypasses normal visibility, can optionally include soft-deleted items.
 */
export class AdminClient {
  /**
   * @param {HttpClient} http - HTTP client instance
   */
  constructor(http) {
    this.http = http;
  }

  /**
   * Build standard list params
   * @private
   */
  _listParams({ page, since, showDeleted, type } = {}) {
    const params = {};
    if (page) params.page = page;
    if (since) params.since = since;
    if (showDeleted) params.deleted = 'true';
    if (type) params.type = type;
    return params;
  }

  // ---- Activities ----

  async getActivities(options = {}) {
    return await this.http.get('/admin/activities', { params: this._listParams(options) });
  }

  async getActivity(options) {
    const { activityId } = options;
    if (!activityId) throw new ValidationError('activityId is required');
    return await this.http.get(`/admin/activities/${encodeURIComponent(activityId)}`);
  }

  async updateActivity(options) {
    const { activityId, updates } = options;
    if (!activityId) throw new ValidationError('activityId is required');
    return await this.http.patch(`/admin/activities/${encodeURIComponent(activityId)}`, updates);
  }

  async deleteActivity(options) {
    const { activityId, fullDelete } = options;
    if (!activityId) throw new ValidationError('activityId is required');
    const params = {};
    if (fullDelete) params.fullDelete = 'true';
    return await this.http.delete(`/admin/activities/${encodeURIComponent(activityId)}`, { params });
  }

  // ---- Users ----

  async getUsers(options = {}) {
    return await this.http.get('/admin/users', { params: this._listParams(options) });
  }

  async getUser(options) {
    const { userId } = options;
    if (!userId) throw new ValidationError('userId is required');
    return await this.http.get(`/admin/users/${encodeURIComponent(userId)}`);
  }

  async updateUser(options) {
    const { userId, updates } = options;
    if (!userId) throw new ValidationError('userId is required');
    return await this.http.patch(`/admin/users/${encodeURIComponent(userId)}`, updates);
  }

  async deleteUser(options) {
    const { userId, fullDelete } = options;
    if (!userId) throw new ValidationError('userId is required');
    const params = {};
    if (fullDelete) params.fullDelete = 'true';
    return await this.http.delete(`/admin/users/${encodeURIComponent(userId)}`, { params });
  }

  async restoreUser(options) {
    const { userId } = options;
    if (!userId) throw new ValidationError('userId is required');
    return await this.http.post(`/admin/users/${encodeURIComponent(userId)}/restore`);
  }

  // ---- Circles ----

  async getCircles(options = {}) {
    return await this.http.get('/admin/circles', { params: this._listParams(options) });
  }

  async getCircle(options) {
    const { circleId } = options;
    if (!circleId) throw new ValidationError('circleId is required');
    return await this.http.get(`/admin/circles/${encodeURIComponent(circleId)}`);
  }

  async updateCircle(options) {
    const { circleId, updates } = options;
    if (!circleId) throw new ValidationError('circleId is required');
    return await this.http.patch(`/admin/circles/${encodeURIComponent(circleId)}`, updates);
  }

  async createCircle(options = {}) {
    const { name, summary, icon, to, canReply, canReact } = options;
    if (!name) throw new ValidationError('name is required');
    const body = { name };
    if (summary !== undefined) body.summary = summary;
    if (icon !== undefined) body.icon = icon;
    if (to) body.to = to;
    if (canReply) body.canReply = canReply;
    if (canReact) body.canReact = canReact;
    return await this.http.post('/admin/circles', body);
  }

  async deleteCircle(options) {
    const { circleId, fullDelete } = options;
    if (!circleId) throw new ValidationError('circleId is required');
    const params = {};
    if (fullDelete) params.fullDelete = 'true';
    return await this.http.delete(`/admin/circles/${encodeURIComponent(circleId)}`, { params });
  }

  async restoreCircle(options) {
    const { circleId } = options;
    if (!circleId) throw new ValidationError('circleId is required');
    return await this.http.post(`/admin/circles/${encodeURIComponent(circleId)}/restore`);
  }

  // ---- Groups ----

  async getGroups(options = {}) {
    return await this.http.get('/admin/groups', { params: this._listParams(options) });
  }

  async getGroup(options) {
    const { groupId } = options;
    if (!groupId) throw new ValidationError('groupId is required');
    return await this.http.get(`/admin/groups/${encodeURIComponent(groupId)}`);
  }

  async createGroup(options = {}) {
    const { name, summary, icon, rsvpPolicy, to, canReply, canReact, urls, location } = options;
    if (!name) throw new ValidationError('name is required');
    const body = { name };
    if (summary !== undefined) body.summary = summary;
    if (icon !== undefined) body.icon = icon;
    if (rsvpPolicy) body.rsvpPolicy = rsvpPolicy;
    if (to) body.to = to;
    if (canReply) body.canReply = canReply;
    if (canReact) body.canReact = canReact;
    if (urls) body.urls = urls;
    if (location) body.location = location;
    return await this.http.post('/admin/groups', body);
  }

  async updateGroup(options) {
    const { groupId, updates } = options;
    if (!groupId) throw new ValidationError('groupId is required');
    return await this.http.patch(`/admin/groups/${encodeURIComponent(groupId)}`, updates);
  }

  async deleteGroup(options) {
    const { groupId, fullDelete } = options;
    if (!groupId) throw new ValidationError('groupId is required');
    const params = {};
    if (fullDelete) params.fullDelete = 'true';
    return await this.http.delete(`/admin/groups/${encodeURIComponent(groupId)}`, { params });
  }

  async restoreGroup(options) {
    const { groupId } = options;
    if (!groupId) throw new ValidationError('groupId is required');
    return await this.http.post(`/admin/groups/${encodeURIComponent(groupId)}/restore`);
  }

  // ---- Posts ----

  async getPosts(options = {}) {
    return await this.http.get('/admin/posts', { params: this._listParams(options) });
  }

  async getPost(options) {
    const { postId } = options;
    if (!postId) throw new ValidationError('postId is required');
    return await this.http.get(`/admin/posts/${encodeURIComponent(postId)}`);
  }

  async createPost(options = {}) {
    const { type, title, source, summary, image, attachments, tags, to, canReply, canReact, location } = options;
    if (!source?.content?.trim() && !title?.trim()) {
      throw new ValidationError('source.content or title is required');
    }
    const body = {};
    if (type) body.type = type;
    if (title) body.title = title;
    if (source) body.source = source;
    if (summary !== undefined) body.summary = summary;
    if (image !== undefined) body.image = image;
    if (attachments) body.attachments = attachments;
    if (tags) body.tags = tags;
    if (to) body.to = to;
    if (canReply) body.canReply = canReply;
    if (canReact) body.canReact = canReact;
    if (location) body.location = location;
    return await this.http.post('/admin/posts', body);
  }

  async updatePost(options) {
    const { postId, updates } = options;
    if (!postId) throw new ValidationError('postId is required');
    return await this.http.patch(`/admin/posts/${encodeURIComponent(postId)}`, updates);
  }

  async deletePost(options) {
    const { postId, fullDelete } = options;
    if (!postId) throw new ValidationError('postId is required');
    const params = {};
    if (fullDelete) params.fullDelete = 'true';
    return await this.http.delete(`/admin/posts/${encodeURIComponent(postId)}`, { params });
  }

  async restorePost(options) {
    const { postId } = options;
    if (!postId) throw new ValidationError('postId is required');
    return await this.http.post(`/admin/posts/${encodeURIComponent(postId)}/restore`);
  }

  // ---- Bookmarks ----

  async getBookmarks(options = {}) {
    return await this.http.get('/admin/bookmarks', { params: this._listParams(options) });
  }

  async getBookmark(options) {
    const { bookmarkId } = options;
    if (!bookmarkId) throw new ValidationError('bookmarkId is required');
    return await this.http.get(`/admin/bookmarks/${encodeURIComponent(bookmarkId)}`);
  }

  async createBookmark(options = {}) {
    const { title, summary, type, href, target, image, tags, to, parentFolder } = options;
    if (!title) throw new ValidationError('title is required');
    const body = { title };
    if (summary !== undefined) body.summary = summary;
    if (type) body.type = type;
    if (href) body.href = href;
    if (target) body.target = target;
    if (image !== undefined) body.image = image;
    if (tags) body.tags = tags;
    if (to) body.to = to;
    if (parentFolder !== undefined) body.parentFolder = parentFolder;
    return await this.http.post('/admin/bookmarks', body);
  }

  async updateBookmark(options) {
    const { bookmarkId, updates } = options;
    if (!bookmarkId) throw new ValidationError('bookmarkId is required');
    return await this.http.patch(`/admin/bookmarks/${encodeURIComponent(bookmarkId)}`, updates);
  }

  async deleteBookmark(options) {
    const { bookmarkId, fullDelete } = options;
    if (!bookmarkId) throw new ValidationError('bookmarkId is required');
    const params = {};
    if (fullDelete) params.fullDelete = 'true';
    return await this.http.delete(`/admin/bookmarks/${encodeURIComponent(bookmarkId)}`, { params });
  }

  async restoreBookmark(options) {
    const { bookmarkId } = options;
    if (!bookmarkId) throw new ValidationError('bookmarkId is required');
    return await this.http.post(`/admin/bookmarks/${encodeURIComponent(bookmarkId)}/restore`);
  }

  // ---- Pages ----

  async getPages(options = {}) {
    return await this.http.get('/admin/pages', { params: this._listParams(options) });
  }

  async getPage(options) {
    const { pageId } = options;
    if (!pageId) throw new ValidationError('pageId is required');
    return await this.http.get(`/admin/pages/${encodeURIComponent(pageId)}`);
  }

  async updatePage(options) {
    const { pageId, updates } = options;
    if (!pageId) throw new ValidationError('pageId is required');
    return await this.http.patch(`/admin/pages/${encodeURIComponent(pageId)}`, updates);
  }

  async createPage(options = {}) {
    const { title, slug, type, summary, source, to, canReply, canReact, order, parentId, href, tags } = options;
    if (!title) throw new ValidationError('title is required');
    const body = { title };
    if (slug) body.slug = slug;
    if (type) body.type = type;
    if (summary) body.summary = summary;
    if (source) body.source = source;
    if (to) body.to = to;
    if (canReply) body.canReply = canReply;
    if (canReact) body.canReact = canReact;
    if (order !== undefined) body.order = order;
    if (parentId) body.parentId = parentId;
    if (href) body.href = href;
    if (tags) body.tags = tags;
    if ('image' in options) body.image = options.image;
    return await this.http.post('/admin/pages', body);
  }

  async deletePage(options) {
    const { pageId, fullDelete } = options;
    if (!pageId) throw new ValidationError('pageId is required');
    const params = {};
    if (fullDelete) params.fullDelete = 'true';
    return await this.http.delete(`/admin/pages/${encodeURIComponent(pageId)}`, { params });
  }

  async restorePage(options) {
    const { pageId } = options;
    if (!pageId) throw new ValidationError('pageId is required');
    return await this.http.post(`/admin/pages/${encodeURIComponent(pageId)}/restore`);
  }

  // ---- Discover: shelves + discovery items ----

  async getSections(options = {}) {
    return await this.http.get('/admin/sections', { params: this._listParams(options) });
  }

  async createSection(options = {}) {
    const { name, summary, order, to, active } = options;
    if (!name) throw new ValidationError('name is required');
    const body = { name };
    if (summary !== undefined) body.summary = summary;
    if (order !== undefined) body.order = order;
    if (to) body.to = to;
    if (active !== undefined) body.active = active;
    return await this.http.post('/admin/sections', body);
  }

  async updateSection(options) {
    const { sectionId, updates } = options;
    if (!sectionId) throw new ValidationError('sectionId is required');
    return await this.http.patch(`/admin/sections/${encodeURIComponent(sectionId)}`, updates);
  }

  async deleteSection(options) {
    const { sectionId, fullDelete } = options;
    if (!sectionId) throw new ValidationError('sectionId is required');
    const params = {};
    if (fullDelete) params.fullDelete = 'true';
    return await this.http.delete(`/admin/sections/${encodeURIComponent(sectionId)}`, { params });
  }

  async getDiscoveryItems(options = {}) {
    const { section, refType, ...rest } = options;
    const params = this._listParams(rest);
    if (section) params.section = section;
    if (refType) params.refType = refType;
    return await this.http.get('/admin/discovery', { params });
  }

  async addDiscoveryItem(options = {}) {
    const { ref, section, note, order } = options;
    if (!ref) throw new ValidationError('ref is required');
    if (!section) throw new ValidationError('section is required');
    const body = { ref, section };
    if (note !== undefined) body.note = note;
    if (order !== undefined) body.order = order;
    return await this.http.post('/admin/discovery', body);
  }

  async updateDiscoveryItem(options) {
    const { discoveryId, updates } = options;
    if (!discoveryId) throw new ValidationError('discoveryId is required');
    return await this.http.patch(`/admin/discovery/${encodeURIComponent(discoveryId)}`, updates);
  }

  async removeDiscoveryItem(options) {
    const { discoveryId, fullDelete } = options;
    if (!discoveryId) throw new ValidationError('discoveryId is required');
    const params = {};
    if (fullDelete) params.fullDelete = 'true';
    return await this.http.delete(`/admin/discovery/${encodeURIComponent(discoveryId)}`, { params });
  }

  // ---- Invites ----

  async createInvite(options = {}) {
    // Field names must match the server (routes/admin/invites.js): email +
    // maxRedemptions, not the old recipient/amount, which were silently dropped
    // — so individual invites lost their email and the server rejected them.
    const { type, email, maxRedemptions, expiresAt, note, welcomeMessage } = options;

    const body = {};
    if (type) body.type = type;
    if (email) body.email = email;
    if (maxRedemptions != null) body.maxRedemptions = maxRedemptions;
    if (expiresAt) body.expiresAt = expiresAt;
    if (note) body.note = note;
    if (welcomeMessage) body.welcomeMessage = welcomeMessage;

    return await this.http.post('/admin/invites', body);
  }

  async getInvites(options = {}) {
    const { page, type, redeemed, since } = options;

    const params = {};
    if (page) params.page = page;
    if (type) params.type = type;
    if (redeemed !== undefined) params.redeemed = String(redeemed);
    if (since) params.since = since;

    return await this.http.get('/admin/invites', { params });
  }

  async deleteInvite(options) {
    const { inviteId } = options;
    if (!inviteId) throw new ValidationError('inviteId is required');
    return await this.http.delete(`/admin/invites/${encodeURIComponent(inviteId)}`);
  }

  // ---- Moderation ----

  async getFlagged(options = {}) {
    return await this.http.get('/admin/flagged', { params: this._listParams(options) });
  }

  async getFlag(options) {
    const { flagId } = options;
    if (!flagId) throw new ValidationError('flagId is required');
    return await this.http.get(`/admin/flagged/${encodeURIComponent(flagId)}`);
  }

  async resolveFlag(options) {
    const { flagId, status, notes } = options;
    if (!flagId) throw new ValidationError('flagId is required');
    if (!['resolved', 'dismissed'].includes(status)) throw new ValidationError("status must be 'resolved' or 'dismissed'");
    return await this.http.patch(`/admin/flagged/${encodeURIComponent(flagId)}`, { status, notes });
  }

  // ---- Settings ----

  async getSettings(options = {}) {
    const params = {};
    if (options.page) params.page = options.page;
    return await this.http.get('/admin/settings', { params });
  }

  async getSetting(options) {
    const { settingId } = options;
    if (!settingId) throw new ValidationError('settingId is required');
    return await this.http.get(`/admin/settings/${encodeURIComponent(settingId)}`);
  }

  async updateSetting(options) {
    const { settingId, value } = options;
    if (!settingId) throw new ValidationError('settingId is required');
    return await this.http.patch(`/admin/settings/${encodeURIComponent(settingId)}`, { value });
  }

  async deleteSetting(options) {
    const { settingId } = options;
    if (!settingId) throw new ValidationError('settingId is required');
    return await this.http.delete(`/admin/settings/${encodeURIComponent(settingId)}`);
  }

  // ---- Server Management ----

  async restartServer() {
    return await this.http.post('/admin/server/restart');
  }

  async serverStats() {
    return await this.http.get('/admin/system');
  }

  async getAdmins() {
    return await this.http.get('/admin/system/admins');
  }

  async addAdmin({ userId }) {
    if (!userId) throw new ValidationError('userId is required');
    return await this.http.post('/admin/system/admins', { userId });
  }

  async removeAdmin({ userId }) {
    if (!userId) throw new ValidationError('userId is required');
    return await this.http.delete(`/admin/system/admins/${encodeURIComponent(userId)}`);
  }

  async getMods() {
    return await this.http.get('/admin/system/mods');
  }

  async addMod({ userId }) {
    if (!userId) throw new ValidationError('userId is required');
    return await this.http.post('/admin/system/mods', { userId });
  }

  async removeMod({ userId }) {
    if (!userId) throw new ValidationError('userId is required');
    return await this.http.delete(`/admin/system/mods/${encodeURIComponent(userId)}`);
  }

  async getLogs(options = {}) {
    const { tail = 200, level = 'all' } = options;
    return await this.http.get('/admin/system/logs', { params: { tail, level } });
  }

  // ---- Backup / Restore ----

  async createBackup() {
    return await this.http.post('/admin/backup');
  }

  async listBackups() {
    return await this.http.get('/admin/backup');
  }

  async getBackupJob(jobId) {
    if (!jobId) throw new ValidationError('jobId is required');
    return await this.http.get(`/admin/backup/${encodeURIComponent(jobId)}`);
  }

  async deleteBackup(jobId) {
    if (!jobId) throw new ValidationError('jobId is required');
    return await this.http.delete(`/admin/backup/${encodeURIComponent(jobId)}`);
  }

  backupDownloadUrl(jobId) {
    if (!jobId) throw new ValidationError('jobId is required');
    const base = this.http.baseUrl?.replace(/\/$/, '') || '';
    return `${base}/admin/backup/${encodeURIComponent(jobId)}/download`;
  }

  async restoreFromFile(file) {
    if (!file) throw new ValidationError('file is required');
    const formData = new FormData();
    formData.append('archive', file, file.name || 'archive.tar.gz');

    // Raw fetch — HttpClient always JSON.stringifies the body, which doesn't work for FormData
    const token = await this.http.getToken();
    const url = this.http._buildUrl('/admin/backup/restore');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, { method: 'POST', headers, body: formData });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || `Restore failed with status ${response.status}`);
    }
    return await response.json();
  }

  async adminSearch(options) {
    const { query, page, since, showDeleted, searchIn } = options;
    if (!query) throw new ValidationError('query is required');

    const params = { q: query };
    if (page) params.page = page;
    if (since) params.since = since;
    if (showDeleted) params.deleted = 'true';
    if (searchIn) {
      const types = Object.entries(searchIn)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (types.length > 0) params.searchIn = types.join(',');
    }

    return await this.http.get('/admin/search', { params });
  }
}

export default AdminClient;
