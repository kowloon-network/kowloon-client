// Moderation module for Kowloon client
//
// The server enforces block/mute on everything it serves to an authenticated
// viewer — but some content is fetched anonymously straight from a REMOTE
// server (previewing another server's public firehose, its /discovery,
// etc.). A remote server has no idea who's asking in that case, and can't
// apply your blocks/mutes for you — RS256 JWTs are signed per-server, so a
// token from your home server can't even be verified by a different one.
// This client-side filter is how those anonymous, cross-server views still
// respect your own blocked/muted list.

function domainOf(actorId) {
  return typeof actorId === 'string' ? actorId.split('@').pop() : undefined;
}

function emptySets() {
  return {
    blockedActorIds: new Set(),
    blockedDomains: new Set(),
    mutedActorIds: new Set(),
    mutedDomains: new Set(),
  };
}

// Circle members are either a person ("@user@domain") or a whole server
// ("@domain", one @) — mirrors the server's methods/visibility/context.js.
function splitMembers(members) {
  const actorIds = new Set();
  const domains = new Set();
  for (const m of members ?? []) {
    const id = m?.id;
    if (typeof id !== 'string' || !id) continue;
    if (/^@[^@]+$/.test(id)) domains.add(id.slice(1).toLowerCase());
    else actorIds.add(id);
  }
  return { actorIds, domains };
}

/**
 * Moderation client — the current user's own blocked/muted list, fetched
 * once and cached, with helpers to filter content client-side.
 */
export class ModerationClient {
  /**
   * @param {HttpClient} http - HTTP client instance
   * @param {AuthClient} auth - Auth client instance (source of the logged-in
   *   user's blocked/muted circle ids)
   */
  constructor(http, auth) {
    this.http = http;
    this.auth = auth;
    this._cache = null;
    this._inflight = null;
  }

  async _loadCircle(circleId) {
    if (!circleId) return { actorIds: new Set(), domains: new Set() };
    try {
      const res = await this.http.get(`/circles/${encodeURIComponent(circleId)}`);
      const circle = res?.item ?? res;
      return splitMembers(circle?.members);
    } catch {
      // Best-effort — if the circle can't be fetched (offline, transient
      // error), filtering just no-ops rather than blocking the caller.
      return { actorIds: new Set(), domains: new Set() };
    }
  }

  /**
   * Fetch (or return the cached) blocked/muted actor ids + domains for the
   * logged-in user. Cheap to call repeatedly — concurrent calls share one
   * in-flight request, and the result is cached until invalidate().
   * @param {Object} [options]
   * @param {boolean} [options.force] - Refetch even if already cached
   * @returns {Promise<{blockedActorIds: Set, blockedDomains: Set, mutedActorIds: Set, mutedDomains: Set}>}
   */
  async load({ force = false } = {}) {
    if (this._cache && !force) return this._cache;
    if (this._inflight && !force) return this._inflight;

    const user = this.auth.getUser();
    if (!user?.id) {
      this._cache = emptySets();
      return this._cache;
    }

    this._inflight = (async () => {
      const [blocked, muted] = await Promise.all([
        this._loadCircle(user.blocked),
        this._loadCircle(user.muted),
      ]);
      this._cache = {
        blockedActorIds: blocked.actorIds,
        blockedDomains: blocked.domains,
        mutedActorIds: muted.actorIds,
        mutedDomains: muted.domains,
      };
      this._inflight = null;
      return this._cache;
    })();
    return this._inflight;
  }

  /** Drop the cache — call after a successful block/unblock/mute/unmute. */
  invalidate() {
    this._cache = null;
  }

  /**
   * True if actorId should be hidden from the viewer's own view (blocked or
   * muted, either individually or via a whole-server entry). Returns false
   * (fail open) if load() hasn't run yet — call load() first.
   * @param {string} actorId
   * @returns {boolean}
   */
  isExcluded(actorId) {
    if (!actorId || !this._cache) return false;
    const { blockedActorIds, mutedActorIds, blockedDomains, mutedDomains } = this._cache;
    if (blockedActorIds.has(actorId) || mutedActorIds.has(actorId)) return true;
    const domain = domainOf(actorId)?.toLowerCase();
    return !!domain && (blockedDomains.has(domain) || mutedDomains.has(domain));
  }

  /**
   * Filter a list of feed-shaped items (posts, discovery items, …),
   * dropping anything from a blocked/muted actor or server. Synchronous —
   * call load() first (or ensure it's already resolved) so the cache is
   * populated; if it isn't, this is a harmless no-op (fails open).
   * @param {Array<Object>} items
   * @param {Object} [options]
   * @param {(item: Object) => string|null|undefined} [options.getActorId] -
   *   Override actor-id extraction for item shapes other than the default
   *   (actorId, then actor.id, then attributedTo.id).
   * @returns {Array<Object>}
   */
  filterItems(items, { getActorId } = {}) {
    if (!Array.isArray(items) || !this._cache) return items;
    const extract = getActorId || ((item) => item?.actorId ?? item?.actor?.id ?? item?.attributedTo?.id);
    return items.filter((item) => !this.isExcluded(extract(item)));
  }
}
