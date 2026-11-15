// Content warnings -- the shared list of categories and the one rule that
// decides what a reader sees. Web and mobile both call
// getContentWarningDecision() so a post looks the same everywhere.
//
// On a Post or Reply:
//   contentWarning: { categories: [key], note: "free text", addedBy?: actorId }
//   sensitive: true  -> blur photos and video until tapped
//
// Each reader picks, per category, "show" | "warn" (tap to show) | "hide"
// (collapsed to one line) in prefs.contentWarnings. The server keeps the
// same keys in methods/contentWarnings.js -- change both together.

export const CW_CATEGORIES = [
  { key: 'spoilers', label: 'Spoilers' },
  { key: 'violence', label: 'Violence' },
  { key: 'sexual', label: 'Sexual content' },
  { key: 'death', label: 'Death or grief' },
  { key: 'selfharm', label: 'Self-harm' },
  { key: 'abuse', label: 'Abuse' },
  { key: 'medical', label: 'Medical' },
  { key: 'flashing', label: 'Flashing images' },
  { key: 'drugs', label: 'Drugs and alcohol' },
  { key: 'eating', label: 'Eating and weight' },
  { key: 'bigotry', label: 'Bigotry or slurs' },
  { key: 'animals', label: 'Animal harm' },
  { key: 'phobias', label: 'Phobias' },
];

export const CW_CHOICES = [
  { value: 'show', label: 'Show' },
  { value: 'warn', label: 'Warn' },
  { value: 'hide', label: 'Hide' },
];

export const CW_NOTE_MAX = 140;

const LABEL = Object.fromEntries(CW_CATEGORIES.map((c) => [c.key, c.label]));
const RANK = { show: 0, warn: 1, hide: 2 };

export function hasContentWarning(post) {
  const cw = post?.contentWarning;
  return !!(cw && ((cw.categories && cw.categories.length) || cw.note));
}

// "Spoilers, Violence: Severance S2" -- what the warning bar says.
export function contentWarningLabel(post) {
  if (!hasContentWarning(post)) return '';
  const cw = post.contentWarning;
  const cats = (cw.categories || []).map((k) => LABEL[k] || k).join(', ');
  if (cats && cw.note) return `${cats}: ${cw.note}`;
  return cats || cw.note;
}

/**
 * What a reader sees for a post.
 * @param {Object} post
 * @param {Object} [opts]
 * @param {Object} [opts.prefs] - the reader's user.prefs
 * @param {string} [opts.viewerId] - the reader's id (their own posts are never hidden)
 * @returns {{
 *   mode: 'show'|'warn'|'hide',  // show the post / show the warning bar, tap to open / one collapsed line
 *   hasWarning: boolean,
 *   label: string,                // for the warning bar
 *   hiddenLabel: string,          // for the collapsed line
 *   blurMedia: boolean,           // blur photos and video until tapped
 *   byModerator: boolean,         // a moderator added the warning
 * }}
 */
export function getContentWarningDecision(post, { prefs, viewerId } = {}) {
  const hasWarning = hasContentWarning(post);
  const own = !!viewerId && post?.actorId === viewerId;
  const showSensitive = prefs?.showSensitiveMedia === true;
  const label = contentWarningLabel(post);
  const byModerator = !!post?.contentWarning?.addedBy;
  const blurMedia = !own && post?.sensitive === true && !showSensitive;

  if (!hasWarning || own) {
    return { mode: 'show', hasWarning, label, hiddenLabel: '', blurMedia, byModerator };
  }

  const choices = prefs?.contentWarnings || {};
  const cats = post.contentWarning.categories || [];
  // A note with no category always warns; otherwise the strictest choice
  // among the post's categories wins.
  let mode = cats.length ? 'show' : 'warn';
  for (const k of cats) {
    const c = RANK[choices[k]] !== undefined ? choices[k] : 'warn';
    if (RANK[c] > RANK[mode]) mode = c;
  }
  const hiddenCats = cats.filter((k) => choices[k] === 'hide').map((k) => (LABEL[k] || k).toLowerCase());
  const hiddenLabel = mode === 'hide' ? `Post hidden (${hiddenCats.join(', ')})` : '';

  return { mode, hasWarning, label, hiddenLabel, blurMedia, byModerator };
}

// The warning a reply starts with: the parent's, minus who added it.
export function inheritedContentWarning(parent) {
  if (!hasContentWarning(parent)) return null;
  return {
    categories: [...(parent.contentWarning.categories || [])],
    note: parent.contentWarning.note || '',
  };
}
