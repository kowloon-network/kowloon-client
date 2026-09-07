// OAuth module for Kowloon client — cross-server identity (see server's
// routes/oauth/*). Two call sites: the HOME server's consent screen calls
// authorize() to mint a code; the FOREIGN server's callback page calls
// exchange() to redeem it for a locally-issued visiting session.

/**
 * OAuth client
 */
export class OAuthClient {
  /**
   * @param {HttpClient} http - HTTP client instance
   * @param {AuthClient} auth - Auth client instance (for storing the resulting session)
   */
  constructor(http, auth) {
    this.http = http;
    this.auth = auth;
  }

  /**
   * Provider side: called from the consent screen (on the user's own home
   * server, already authenticated) after they click Allow. Mints a code and
   * returns the URL to navigate to next.
   * @param {Object} options
   * @param {string} options.clientDomain - the requesting server's domain
   * @param {string} options.redirectUri - must be on clientDomain
   * @param {string} [options.state]
   * @returns {Promise<{ redirectUri: string }>}
   */
  async authorize({ clientDomain, redirectUri, state }) {
    return await this.http.post('/oauth/authorize', { clientDomain, redirectUri, state });
  }

  /**
   * Consumer side: called from this server's own /oauth/callback page after
   * the browser lands back with a `code`. Exchanges it (server-to-server,
   * behind the scenes) for a locally-issued visiting session token, and
   * stores it exactly like a normal login.
   * @param {Object} options
   * @param {string} options.code
   * @param {string} options.homeDomain
   * @returns {Promise<{ user: Object, token: string }>}
   */
  async exchange({ code, homeDomain }) {
    const response = await this.http.post('/oauth/exchange', { code, homeDomain });
    if (!response.token) {
      throw new Error('OAuth exchange failed - no token received');
    }
    await this.auth.setSession(response.token, response.user);
    return { user: response.user, token: response.token };
  }
}

export default OAuthClient;
