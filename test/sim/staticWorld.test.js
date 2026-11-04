import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaticWorld } from '../../src/sim/map/StaticWorld.js';
import { circle, makeMap, rect } from '../../test-support/sim.js';

const world = (obstacles) => new StaticWorld(makeMap({ obstacles }));

test('raycast returns the nearest hit', () => {
  const w = world([rect('far', 500, 300, 20, 200), rect('near', 200, 300, 20, 200)]);
  const hit = w.raycast(0, 400, 900, 400);
  assert.equal(hit.obstacle.id, 'near');
  assert.ok(Math.abs(hit.x - 200) < 1e-9);
  assert.ok(Math.abs(hit.y - 400) < 1e-9);
});

test('raycast honors the predicate and reports misses as null', () => {
  const w = world([rect('low', 200, 300, 20, 200, 'low'), rect('high', 500, 300, 20, 200, 'high')]);
  assert.equal(w.raycast(0, 400, 900, 400, (o) => o.height === 'high').obstacle.id, 'high');
  assert.equal(w.raycast(0, 100, 900, 100), null);
  assert.equal(w.raycast(0, 400, 900, 400, () => false), null);
});

test('segmentBlocked applies the cover rule to a line of sight', () => {
  const w = world([rect('high', 200, 300, 20, 200, 'high'), rect('low', 500, 300, 20, 200, 'low')]);

  assert.equal(w.segmentBlocked(100, 400, 300, 400), true, 'high cover always blocks');
  assert.equal(w.segmentBlocked(400, 400, 600, 400), false, 'standing agents see over low cover');
  assert.equal(w.segmentBlocked(400, 400, 600, 400, { targetCrouched: true }), true);
  assert.equal(w.segmentBlocked(400, 400, 600, 400, { sourceCrouched: true }), true);
  assert.equal(w.segmentBlocked(400, 100, 600, 100), false, 'nothing in the way');
});

test('crossedObstacles lists every obstacle a line passes through', () => {
  const w = world([rect('a', 200, 300, 20, 200), circle('b', 400, 400, 30), rect('far', 800, 300, 20, 200)]);
  assert.deepEqual(w.crossedObstacles(100, 400, 600, 400).map((o) => o.id), ['a', 'b']);
  assert.deepEqual(w.crossedObstacles(100, 100, 600, 100), []);
});

test('resolveCircle pushes out of rectangles and circles', () => {
  const w = world([rect('r', 100, 100, 100, 100), circle('c', 500, 500, 50)]);
  const fromRect = w.resolveCircle(95, 150, 14);
  assert.ok(Math.abs(fromRect.x - 86) < 1e-9);
  const fromCircle = w.resolveCircle(545, 500, 14);
  assert.ok(Math.abs(fromCircle.x - 564) < 1e-9);
});

test('resolveCircle keeps circles inside the map', () => {
  const w = world([]);
  assert.deepEqual(w.resolveCircle(-50, 400, 14), { x: 14, y: 400 });
  assert.deepEqual(w.resolveCircle(5000, 5000, 14), { x: 986, y: 786 });
});

test('circleFits is false when overlapping an obstacle or leaving the map', () => {
  const w = world([rect('r', 100, 100, 100, 100)]);
  assert.equal(w.circleFits(50, 50, 14), true);
  assert.equal(w.circleFits(95, 150, 14), false);
  assert.equal(w.circleFits(5, 400, 14), false);
  assert.equal(w.circleFits(86, 150, 14), true); // touching is fine
});
