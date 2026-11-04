import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEG,
  angleDiff,
  clamp,
  dist,
  distSq,
  lerp,
  normalizeAngle,
  normalizeVector,
  rotateToward,
} from '../../src/core/math.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('clamp and lerp', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-5, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
  assert.equal(lerp(10, 20, 0.25), 12.5);
});

test('distance helpers', () => {
  assert.equal(distSq(0, 0, 3, 4), 25);
  assert.equal(dist(0, 0, 3, 4), 5);
});

test('normalizeAngle wraps into (-PI, PI]', () => {
  assert.ok(near(normalizeAngle(3 * Math.PI), Math.PI));
  assert.ok(near(normalizeAngle(-Math.PI), Math.PI));
  assert.ok(near(normalizeAngle(Math.PI), Math.PI));
  assert.ok(near(normalizeAngle(0.5), 0.5));
  assert.ok(near(normalizeAngle(-3 * Math.PI + 0.25), -Math.PI + 0.25));
});

test('angleDiff takes the short way round', () => {
  assert.ok(near(angleDiff(170 * DEG, -170 * DEG), 20 * DEG));
  assert.ok(near(angleDiff(-170 * DEG, 170 * DEG), -20 * DEG));
  assert.ok(near(angleDiff(0, 0.5), 0.5));
});

test('rotateToward limits the step and does not overshoot', () => {
  assert.ok(near(rotateToward(0, 1, 0.25), 0.25));
  assert.ok(near(rotateToward(0, -1, 0.25), -0.25));
  assert.ok(near(rotateToward(0, 0.1, 0.25), 0.1));
  // crossing the +-PI seam goes the short way
  assert.ok(near(rotateToward(170 * DEG, -170 * DEG, 5 * DEG), 175 * DEG));
});

test('normalizeVector keeps zero as zero', () => {
  assert.deepEqual(normalizeVector(0, 0), { x: 0, y: 0 });
  const v = normalizeVector(3, 4);
  assert.ok(near(v.x, 0.6) && near(v.y, 0.8));
});
