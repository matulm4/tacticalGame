import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handlePoints, hitHandle, hitTest, markerRadius } from '../../src/editor/hitTest.js';
import { ANGLE_HANDLE_REACH } from '../../src/editor/limits.js';
import { circle, makeMap, rect, spawn } from '../../test-support/sim.js';

const map = makeMap({
  obstacles: [rect('r', 100, 100, 200, 100), circle('c', 500, 400, 50)],
  spawns: [spawn('s1', 700, 600, { angle: Math.PI / 2 })],
});

test('hitTest finds rectangles, circles, spawns and the player start', () => {
  assert.deepEqual(hitTest(map, 150, 150, 0), { kind: 'obstacle', id: 'r' });
  assert.deepEqual(hitTest(map, 520, 420, 0), { kind: 'obstacle', id: 'c' });
  assert.deepEqual(hitTest(map, 700, 610, 0), { kind: 'spawn', id: 's1' });
  assert.deepEqual(hitTest(map, 100, 400, 0), { kind: 'playerStart', id: 'playerStart' });
  assert.equal(hitTest(map, 900, 700, 0), null);
});

test('tolerance widens every target', () => {
  assert.equal(hitTest(map, 95, 150, 0), null);
  assert.deepEqual(hitTest(map, 95, 150, 6), { kind: 'obstacle', id: 'r' });
  assert.equal(hitTest(map, 500, 455, 0), null);
  assert.deepEqual(hitTest(map, 500, 455, 6), { kind: 'obstacle', id: 'c' });
});

test('markers use their archetype radius', () => {
  assert.equal(markerRadius('playerStart', map.playerStart), 18);
  assert.equal(markerRadius('spawn', { type: 'grunt' }), 18);
  assert.equal(markerRadius('spawn', { type: 'no-such-type' }), 18, 'unknown types fall back');
});

test('a rectangle has eight handles, corners first; a circle has one on its east side', () => {
  const item = { kind: 'obstacle', id: 'r', data: map.obstacles[0] };
  const handles = handlePoints(item);
  assert.deepEqual(handles.map((h) => h.id), ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w']);
  assert.deepEqual(handles[2], { id: 'se', x: 300, y: 200 });
  assert.deepEqual(handles[5], { id: 'e', x: 300, y: 150 });

  const ring = handlePoints({ kind: 'obstacle', id: 'c', data: map.obstacles[1] });
  assert.deepEqual(ring, [{ id: 'r', x: 550, y: 400 }]);
});

test('a marker has one turn handle in front of it', () => {
  const [handle] = handlePoints({ kind: 'spawn', id: 's1', data: map.spawns[0] });
  assert.equal(handle.id, 'angle');
  assert.ok(Math.abs(handle.x - 700) < 1e-9);
  assert.ok(Math.abs(handle.y - (600 + 18 + ANGLE_HANDLE_REACH)) < 1e-9);
});

test('hitHandle finds the handle under the pointer within tolerance', () => {
  const item = { kind: 'obstacle', id: 'r', data: map.obstacles[0] };
  assert.equal(hitHandle(item, 302, 198, 9), 'se');
  assert.equal(hitHandle(item, 200, 100, 4), 'n');
  assert.equal(hitHandle(item, 200, 150, 9), null);
});
