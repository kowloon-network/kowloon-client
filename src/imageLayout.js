// imageLayout.js -- how feed and post images are shaped and cropped.
//
// Shared by the app and the web so both lay out a post's images the same
// way. Pure functions; no React, no DOM.
//
// Rules (agreed 2026-11-18):
//  - An image shows at its own shape, within limits: no taller than 4:5
//    (so it fits a phone screen with room to spare) and no wider than 2.5:1.
//  - Article/Note header images are shorter: no taller than 5:4.
//  - Several images sit in rows that keep each image's shape; a row's images
//    share one height and together fill the width.
//  - When something must be cropped, the crop keeps the image's focus point
//    (where its subject is) in frame. Focus comes from the poster's tap in
//    the composer, or is detected by the server at upload.
//
// Ratios are width / height throughout (React Native's `aspectRatio`).

export const FEED_IMAGE_LIMITS = { tallest: 4 / 5, widest: 2.5 };
export const HEADER_IMAGE_LIMITS = { tallest: 5 / 4, widest: 2.5 };

// Inside a row of several images, how far each image may stray from its own
// shape, and how short the whole row may get.
const CELL_LIMITS = { tallest: 3 / 5, widest: 2 };
const ROW_WIDEST = 3;

// Assumed shape when an image's size is unknown (old uploads, some links).
export const UNKNOWN_RATIO = 4 / 3;

// An image's own width/height ratio, or null when its size is unknown.
// Accepts an attachment ({ width, height }) or featuredImageInfo.
export function naturalRatio(img) {
  const w = Number(img?.width) || 0;
  const h = Number(img?.height) || 0;
  return w > 0 && h > 0 ? w / h : null;
}

export function clampRatio(ratio, limits = FEED_IMAGE_LIMITS) {
  return Math.min(limits.widest, Math.max(limits.tallest, ratio));
}

// The shape to show one image at on its own.
export function displayRatio(img, limits = FEED_IMAGE_LIMITS) {
  return clampRatio(naturalRatio(img) ?? UNKNOWN_RATIO, limits);
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

// Where to anchor an image that's cropped to fit a box, as fractions for
// CSS `object-position` / expo-image `contentPosition` (0 = left/top edge,
// 1 = right/bottom). Centres the crop on the focus point, sliding it only as
// far as the image's edges allow. No focus -> centred.
export function cropPosition(imageRatio, boxRatio, focus) {
  const fx = Number.isFinite(focus?.x) ? focus.x : 0.5;
  const fy = Number.isFinite(focus?.y) ? focus.y : 0.5;
  if (!imageRatio || !boxRatio || Math.abs(imageRatio - boxRatio) < 0.001) {
    return { x: 0.5, y: 0.5 };
  }
  // Scale of the image's cropped axis relative to the box (> 1).
  if (imageRatio > boxRatio) {
    const k = imageRatio / boxRatio;
    return { x: clamp01((0.5 - fx * k) / (1 - k)), y: 0.5 };
  }
  const k = boxRatio / imageRatio;
  return { x: 0.5, y: clamp01((0.5 - fy * k) / (1 - k)) };
}

// Percent strings for CSS / expo-image, e.g. { left: "30%", top: "50%" }.
export function cropPositionPercent(imageRatio, boxRatio, focus) {
  const { x, y } = cropPosition(imageRatio, boxRatio, focus);
  return { left: `${Math.round(x * 1000) / 10}%`, top: `${Math.round(y * 1000) / 10}%` };
}

// Which images share a row. 1 -> alone; 2 -> side by side; 3 -> one row
// when all three are portraits, otherwise the first alone over the other
// two; 4+ -> pairs, with an odd last image alone.
function groupRows(ratios) {
  const n = ratios.length;
  if (n === 0) return [];
  if (n === 1) return [[0]];
  if (n === 2) return [[0, 1]];
  if (n === 3) {
    const allPortrait = ratios.every((r) => r < 1);
    return allPortrait ? [[0, 1, 2]] : [[0], [1, 2]];
  }
  const rows = [];
  for (let i = 0; i < n; i += 2) rows.push(i + 1 < n ? [i, i + 1] : [i]);
  return rows;
}

// Lay out a post's images (or any media with width/height) as rows.
//
// Returns [{ cells: [{ index, ratio, position }] }]. Render each row as a
// horizontal flex row; give each cell `flexBasis: 0, aspectRatio: ratio`
// and a flexGrow proportional to its ratio, normalised so the row's grows sum
// to 1 (flexbox leaves space empty when they sum to less). Cells then share
// one height and fill the width whatever the gap. `position` is the crop anchor for the image inside.
//
// limits: shape limits for an image that sits alone in its row.
export function layoutImageRows(images, { limits = FEED_IMAGE_LIMITS } = {}) {
  const naturals = images.map((img) => naturalRatio(img));
  const known = naturals.map((r) => r ?? UNKNOWN_RATIO);

  return groupRows(known).map((indexes) => {
    let ratios =
      indexes.length === 1
        ? [clampRatio(known[indexes[0]], limits)]
        : indexes.map((i) => clampRatio(known[i], CELL_LIMITS));

    // Stop a row of wide images becoming a thin strip.
    const total = ratios.reduce((a, b) => a + b, 0);
    if (indexes.length > 1 && total > ROW_WIDEST) {
      ratios = ratios.map((r) => (r * ROW_WIDEST) / total);
    }

    return {
      cells: indexes.map((index, j) => ({
        index,
        ratio: ratios[j],
        position: cropPosition(naturals[index], ratios[j], images[index]?.focus),
      })),
    };
  });
}
