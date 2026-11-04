import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CircleShape, RectShape, createShape } from '../../src/core/shapes.js';

test('RectShape: bounds, containment, raycast, push-out', () => {
  const shape = new RectShape({ x: 100, y: 100, w: 100, h: 50 });
  assert.deepEqual(shape.bounds, { minX: 100, minY: 100, maxX: 200, maxY: 150 });
  assert.ok(shape.containsPoint(150, 120));
  assert.ok(!shape.containsPoint(99, 120));
  assert.ok(Math.abs(shape.raycast(0, 125, 400, 125) - 0.25) < 1e-9);
  assert.equal(shape.raycast(0, 300, 400, 300), null);
  assert.ok(shape.intersectsCircle(95, 125, 10));
  assert.ok(!shape.intersectsCircle(90, 125, 10)); // touching is not intersecting
});

test('CircleShape: bounds, containment, raycast, push-out', () => {
  const shape = new CircleShape({ cx: 100, cy: 100, r: 20 });
  assert.deepEqual(shape.bounds, { minX: 80, minY: 80, maxX: 120, maxY: 120 });
  assert.ok(shape.containsPoint(110, 100));
  assert.ok(!shape.containsPoint(125, 100));
  assert.ok(Math.abs(shape.raycast(0, 100, 200, 100) - 0.4) < 1e-9);
  const push = shape.pushOutCircle(125, 100, 10);
  assert.ok(Math.abs(push.x - 5) < 1e-9 && Math.abs(push.y) < 1e-9);
});

test('createShape builds from map definitions and rejects unknown shapes', () => {
  assert.equal(createShape({ shape: 'rect', x: 0, y: 0, w: 1, h: 1 }).type, 'rect');
  assert.equal(createShape({ shape: 'circle', cx: 0, cy: 0, r: 1 }).type, 'circle');
  assert.throws(() => createShape({ shape: 'hexagon' }), /Unknown shape/);
});
