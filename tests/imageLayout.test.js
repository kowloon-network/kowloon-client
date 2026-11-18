import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  displayRatio, cropPosition, layoutImageRows, HEADER_IMAGE_LIMITS, UNKNOWN_RATIO,
} from '../src/imageLayout.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} != ${b}`);

test('single images keep their shape within 4:5 .. 2.5:1', () => {
  near(displayRatio({ width: 1600, height: 900 }), 16 / 9);   // landscape: whole
  near(displayRatio({ width: 800, height: 1000 }), 0.8);      // 4:5: whole
  near(displayRatio({ width: 900, height: 1600 }), 0.8);      // 9:16: capped
  near(displayRatio({ width: 4000, height: 1000 }), 2.5);     // panorama: capped
  near(displayRatio({}), UNKNOWN_RATIO);
});

test('header images are no taller than 5:4', () => {
  near(displayRatio({ width: 800, height: 1000 }, HEADER_IMAGE_LIMITS), 1.25);
  near(displayRatio({ width: 1600, height: 900 }, HEADER_IMAGE_LIMITS), 16 / 9);
});

test('crop centres on the focus and stops at the edges', () => {
  // 9:16 portrait in a 4:5 box, subject near the top.
  const top = cropPosition(9 / 16, 0.8, { x: 0.5, y: 0.1 });
  near(top.x, 0.5);
  near(top.y, 0);
  // Subject just below centre: anchor slides a little past 50%.
  const mid = cropPosition(9 / 16, 0.8, { x: 0.5, y: 0.6 });
  assert.ok(mid.y > 0.5 && mid.y < 1);
  // Panorama, subject on the right.
  near(cropPosition(4, 2.5, { x: 0.95, y: 0.5 }).x, 1);
  // No focus, or no crop needed: centred.
  assert.deepEqual(cropPosition(9 / 16, 0.8, null), { x: 0.5, y: 0.5 });
  assert.deepEqual(cropPosition(1.5, 1.5, { x: 0, y: 0 }), { x: 0.5, y: 0.5 });
});

test('rows: 2 side by side, 3 portraits in one row, 3 mixed as 1 + 2, 4 as 2 + 2', () => {
  const land = { width: 1500, height: 1000 };
  const port = { width: 1000, height: 1500 };
  assert.deepEqual(layoutImageRows([land, port]).map((r) => r.cells.length), [2]);
  assert.deepEqual(layoutImageRows([port, port, port]).map((r) => r.cells.length), [3]);
  assert.deepEqual(layoutImageRows([land, port, port]).map((r) => r.cells.length), [1, 2]);
  assert.deepEqual(layoutImageRows([land, land, land, land]).map((r) => r.cells.length), [2, 2]);
  assert.deepEqual(layoutImageRows([land, land, land, land, land]).map((r) => r.cells.length), [2, 2, 1]);
});

test('row cells keep their own shapes', () => {
  const [row] = layoutImageRows([{ width: 1500, height: 1000 }, { width: 1000, height: 1500 }]);
  near(row.cells[0].ratio, 1.5);
  near(row.cells[1].ratio, 2 / 3);
});

test('a row of panoramas is kept from becoming a strip', () => {
  const pano = { width: 4000, height: 1000 };
  const [row] = layoutImageRows([pano, pano]);
  near(row.cells.reduce((a, c) => a + c.ratio, 0), 3);
});
