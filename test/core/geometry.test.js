import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  circleCirclePush,
  circleRectPush,
  segmentCircleHit,
  segmentExitRect,
  segmentRectHit,
} from '../../src/core/geometry.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('segmentCircleHit: head-on returns the entry point', () => {
  assert.ok(near(segmentCircleHit(0, 0, 100, 0, 50, 0, 10), 0.4));
});

test('segmentCircleHit: misses, short segments and moving away return null', () => {
  assert.equal(segmentCircleHit(0, 0, 100, 0, 50, 20, 10), null);
  assert.equal(segmentCircleHit(0, 0, 30, 0, 50, 0, 10), null);
  assert.equal(segmentCircleHit(0, 0, -100, 0, 50, 0, 10), null);
});

test('segmentCircleHit: starting inside is a hit at t = 0', () => {
  assert.equal(segmentCircleHit(50, 0, 100, 0, 50, 0, 10), 0);
});

test('segmentRectHit: crosses, starts inside, parallel miss, corner graze', () => {
  assert.ok(near(segmentRectHit(0, 150, 300, 150, 100, 100, 200, 200), 1 / 3));
  assert.equal(segmentRectHit(150, 150, 400, 150, 100, 100, 200, 200), 0);
  assert.equal(segmentRectHit(0, 50, 300, 50, 100, 100, 200, 200), null);
  assert.ok(near(segmentRectHit(0, 0, 300, 300, 100, 100, 200, 200), 1 / 3));
  assert.equal(segmentRectHit(0, 0, 50, 300, 100, 100, 200, 200), null);
});

test('segmentRectHit: zero-length segments', () => {
  assert.equal(segmentRectHit(150, 150, 150, 150, 100, 100, 200, 200), 0);
  assert.equal(segmentRectHit(0, 0, 0, 0, 100, 100, 200, 200), null);
});

test('segmentExitRect: reports where a segment leaves, null while inside', () => {
  assert.ok(near(segmentExitRect(50, 50, 150, 50, 0, 0, 100, 100), 0.5));
  assert.ok(near(segmentExitRect(50, 50, 50, -50, 0, 0, 100, 100), 0.5));
  assert.equal(segmentExitRect(50, 50, 60, 60, 0, 0, 100, 100), null);
});

test('circleRectPush: pushes out of a side, a corner, and from inside', () => {
  const side = circleRectPush(95, 150, 10, 100, 100, 200, 200);
  assert.ok(near(side.x, -5) && near(side.y, 0));

  const corner = circleRectPush(95, 95, 10, 100, 100, 200, 200);
  assert.ok(near(corner.x, corner.y) && corner.x < 0);
  assert.ok(near(Math.hypot(corner.x, corner.y), 10 - Math.hypot(5, 5)));

  const inside = circleRectPush(110, 150, 10, 100, 100, 200, 200);
  assert.ok(near(110 + inside.x, 90)); // ends up touching the left side
});

test('circleRectPush: no overlap, and touching, return null', () => {
  assert.equal(circleRectPush(80, 150, 10, 100, 100, 200, 200), null);
  assert.equal(circleRectPush(90, 150, 10, 100, 100, 200, 200), null);
});

test('circleCirclePush: separates overlapping circles', () => {
  const push = circleCirclePush(0, 0, 10, 15, 0, 10);
  assert.ok(near(push.x, -5) && near(push.y, 0));
  assert.equal(circleCirclePush(0, 0, 10, 100, 0, 10), null);
  assert.deepEqual(circleCirclePush(0, 0, 10, 0, 0, 10), { x: 20, y: 0 });
});
