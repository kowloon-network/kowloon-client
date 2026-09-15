// Pure string classifier — no server required. Kept in sync by hand with
// server methods/parse/kowloonId.js; these cases mirror that file's own
// shape (User/Server/typed-object-id/URL/Unknown).

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseKowloonId, isKowloonId, isNavigableKowloonId } from '../src/utils/kowloonId.js';

describe('parseKowloonId', () => {
  it('classifies a user id', () => {
    assert.deepStrictEqual(parseKowloonId('@alice@kwln.org'), {
      type: 'User',
      domain: 'kwln.org',
      userId: '@alice@kwln.org',
    });
  });

  it('classifies a bare-domain server reference', () => {
    assert.deepStrictEqual(parseKowloonId('@kwln.org'), {
      type: 'Server',
      domain: 'kwln.org',
      userId: null,
    });
  });

  it('classifies every typed object id kind', () => {
    const kinds = {
      post: 'Post',
      reply: 'Reply',
      react: 'React',
      group: 'Group',
      circle: 'Circle',
      page: 'Page',
      bookmark: 'Bookmark',
    };
    for (const [kind, type] of Object.entries(kinds)) {
      const result = parseKowloonId(`${kind}:abc123@kwln.org`);
      assert.strictEqual(result.type, type, `${kind}: expected ${type}, got ${result.type}`);
      assert.strictEqual(result.domain, 'kwln.org');
    }
  });

  it('classifies http(s) links as URL, not as an object id', () => {
    const result = parseKowloonId('https://kwln.org/posts/post:abc@kwln.org');
    assert.strictEqual(result.type, 'URL');
    assert.strictEqual(result.domain, 'kwln.org');
  });

  it('rejects non-http(s) schemes as not a web URL', () => {
    // No "://" scheme at all, and not @-prefixed or kind:local@domain shaped —
    // falls through to Unknown rather than being misclassified.
    assert.strictEqual(parseKowloonId('javascript:alert(1)').type, 'Unknown');
  });

  it('treats plain search text as Unknown', () => {
    assert.strictEqual(parseKowloonId('just searching for something').type, 'Unknown');
    assert.strictEqual(parseKowloonId('').type, 'Unknown');
    assert.strictEqual(parseKowloonId('   ').type, 'Unknown');
  });

  it('isKowloonId / isNavigableKowloonId agree with the type classification', () => {
    assert.strictEqual(isKowloonId('@alice@kwln.org'), true);
    assert.strictEqual(isKowloonId('random text'), false);

    // Post/Circle/Group/Page/User/Server all have a real destination today.
    assert.strictEqual(isNavigableKowloonId('post:abc@kwln.org'), true);
    assert.strictEqual(isNavigableKowloonId('@alice@kwln.org'), true);
    assert.strictEqual(isNavigableKowloonId('@kwln.org'), true);

    // Bookmark/Reply/React are recognized ids but have no standalone page on
    // either platform — always rendered inline on their parent, or (for
    // Bookmark) only ever listed under their owner. Not navigable.
    assert.strictEqual(isNavigableKowloonId('bookmark:abc@kwln.org'), false);
    assert.strictEqual(isNavigableKowloonId('reply:abc@kwln.org'), false);
    assert.strictEqual(isNavigableKowloonId('react:abc@kwln.org'), false);
  });
});
