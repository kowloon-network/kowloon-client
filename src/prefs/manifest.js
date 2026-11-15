// Preferences manifest — the single, platform-agnostic description of every
// user preference the settings UI should expose. Web and mobile both render
// their preferences screens by iterating this list, so adding a preference is a
// one-line change here (plus the schema default on the server).
//
// This is PURE DATA — no React, no platform imports. Each entry declares how a
// pref should be presented; the actual values live flat on `user.prefs[key]`
// (never wrapped in {label,value} — that metadata is identical for every user
// and would only bloat documents and leak into federation). Nested keys use
// dot-paths (e.g. "notifications.mention" → user.prefs.notifications.mention).
//
// Control `type`s:
//   toggle       — boolean Switch
//   select       — single choice from `options`
//   multiselect  — any subset of `options` (stored as an array)
//   audience     — a Kowloon audience (public / server / circle / group); the
//                  platform supplies the picker (mobile: AudienceSelector)
//   timezone     — an IANA time zone; platform supplies the picker

import { CW_CATEGORIES, CW_CHOICES } from "../contentWarnings.js";

export const PREF_GROUPS = [
  { key: "general", label: "General" },
  { key: "composing", label: "Composing" },
  { key: "feed", label: "Feed" },
  { key: "contentWarnings", label: "Content warnings" },
  { key: "notifications", label: "Notifications" },
];

// Home-screen options are tab route slugs so the client can route straight to
// them on launch. `adminOnly` options are shown only to server admins (the
// renderer filters them). Extend this list as new launchable screens appear.
const HOME_SCREEN_OPTIONS = [
  { value: "discover", label: "Discover" },
  { value: "feed", label: "Feed" },
  { value: "search", label: "Search" },
  { value: "admin", label: "Admin", adminOnly: true },
];

const POST_TYPE_OPTIONS = [
  { value: "Note", label: "Note" },
  { value: "Article", label: "Article" },
  { value: "Media", label: "Media" },
  { value: "Link", label: "Link" },
  { value: "Event", label: "Event" },
];

export const PREFS = [
  // General
  {
    key: "defaultHomeScreen",
    group: "general",
    type: "select",
    label: "Home screen",
    hint: "Which screen opens when you launch the app.",
    options: HOME_SCREEN_OPTIONS,
    default: "discover",
  },

  // Composing
  {
    key: "defaultPostType",
    group: "composing",
    type: "select",
    label: "Default post type",
    hint: "Which type the composer opens to.",
    options: POST_TYPE_OPTIONS,
    default: "Note",
  },
  {
    key: "defaultTo",
    group: "composing",
    type: "audience",
    label: "Default audience",
    hint: "Who can see a new post unless you change it.",
    default: "@public",
  },
  {
    key: "defaultcanReply",
    group: "composing",
    type: "audience",
    label: "Who can reply by default",
    default: "@public",
  },
  {
    key: "defaultcanReact",
    group: "composing",
    type: "audience",
    label: "Who can react by default",
    default: "@public",
  },

  // Feed
  {
    key: "defaultPostView",
    group: "feed",
    type: "multiselect",
    label: "Post types shown in your feed",
    hint: "The default filter for your timeline (matches the feed filter bar).",
    options: POST_TYPE_OPTIONS,
    default: ["Note", "Article", "Media", "Link"],
  },

  // Content warnings (nested under prefs.contentWarnings.*): what to do with
  // posts carrying each warning. "warn" = show the warning, tap to read;
  // "hide" = collapse to one line.
  ...CW_CATEGORIES.map((c, i) => ({
    key: `contentWarnings.${c.key}`,
    group: "contentWarnings",
    type: "select",
    label: c.label,
    ...(i === 0 ? { hint: "For posts with each warning: show them, warn first, or hide them." } : {}),
    options: CW_CHOICES,
    default: "warn",
  })),
  {
    key: "showSensitiveMedia",
    group: "contentWarnings",
    type: "toggle",
    label: "Show sensitive photos without blurring",
    default: false,
  },

  // Notifications (nested under prefs.notifications.*). "follow" is intentionally
  // omitted — Kowloon never notifies on being added to a circle.
  {
    key: "notifications.reply",
    group: "notifications",
    type: "toggle",
    label: "Replies to your posts",
    default: true,
  },
  {
    key: "notifications.react",
    group: "notifications",
    type: "toggle",
    label: "Reactions to your posts",
    default: true,
  },
  {
    key: "notifications.mention",
    group: "notifications",
    type: "toggle",
    label: "Mentions",
    hint: "When someone tags @you in a post or reply.",
    default: true,
  },
  {
    key: "notifications.new_post",
    group: "notifications",
    type: "toggle",
    label: "New posts in your feeds",
    hint: "A gentle nudge, at most once every 12 hours.",
    default: true,
  },
  {
    key: "notifications.join_request",
    group: "notifications",
    type: "toggle",
    label: "Group join requests",
    hint: "For groups you moderate.",
    default: true,
  },
  {
    key: "notifications.join_approved",
    group: "notifications",
    type: "toggle",
    label: "Your join request approved",
    default: true,
  },
  {
    key: "notifications.toasts",
    group: "notifications",
    type: "toggle",
    label: "In-app toast popups",
    default: true,
  },

  // General
  // Deliberately NOT in this manifest:
  // - `timezone`: dates already render in the viewer's device zone (Intl with no
  //   timeZone), so per-viewer times are correct automatically — a per-user zone
  //   override is redundant. (Venue-local *event* times, if ever wanted, need a
  //   per-EVENT zone, not a user pref.)
  // - `theme`: mobile has no dark mode yet; the web frontend sets its theme via
  //   its own screen.
  // - `lang`: the app auto-detects language from the OS (expo-localization on
  //   mobile, browser LanguageDetector on web). `prefs.lang` stays in the User
  //   schema as the future OVERRIDE slot (empty = follow OS); an override picker
  //   gets added here, defaulting to "Automatic", when i18n + a 2nd language ship.
];

// Read a possibly-dot-pathed pref value off a prefs object, falling back to the
// manifest default.
export function getPrefValue(prefs, entry) {
  const parts = entry.key.split(".");
  let v = prefs;
  for (const p of parts) v = v == null ? undefined : v[p];
  return v === undefined || v === null ? entry.default : v;
}
