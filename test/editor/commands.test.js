import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AddObstacle,
  AddSpawn,
  ClearMap,
  RemoveObstacle,
  RemoveSpawn,
  SetCoverHeight,
  SetObstacleGeometry,
  SetPlayerStart,
  SetSpawn,
} from '../../src/editor/commands/index.js';
import { circle, makeMap, rect, spawn } from '../../test-support/sim.js';

const mapWithContent = () =>
  makeMap({
    obstacles: [rect('a', 100, 100, 50, 50), circle('b', 400, 400, 30, 'low'), rect('c', 600, 100, 20, 20)],
    spawns: [spawn('s1', 800, 400), spawn('s2', 800, 500)],
  });

/** Applying a command and then undoing it must give back exactly the original map. */
function roundTrip(makeCommand) {
  const map = mapWithContent();
  const original = structuredClone(map);
  const command = makeCommand();

  command.do(map);
  assert.notDeepEqual(map, original, 'the command changed something');
  command.undo(map);
  assert.deepEqual(map, original, 'undo restored the map');

  command.do(map); // redo
  assert.notDeepEqual(map, original);
  return { map, original };
}

test('AddObstacle adds at the end', () => {
  const { map } = roundTrip(() => new AddObstacle(rect('new', 1, 2, 30, 40)));
  assert.equal(map.obstacles.at(-1).id, 'new');
});

test('RemoveObstacle removes and restores at the same position', () => {
  const { map } = roundTrip(() => new RemoveObstacle('b'));
  assert.deepEqual(map.obstacles.map((o) => o.id), ['a', 'c']);
});

test('SetObstacleGeometry moves a rectangle and resizes a circle', () => {
  const rectResult = roundTrip(
    () => new SetObstacleGeometry('a', { x: 100, y: 100, w: 50, h: 50 }, { x: 120, y: 90, w: 70, h: 60 }),
  );
  assert.deepEqual(rectResult.map.obstacles[0], { ...rect('a', 120, 90, 70, 60) });

  const circleResult = roundTrip(
    () => new SetObstacleGeometry('b', { cx: 400, cy: 400, r: 30 }, { cx: 410, cy: 400, r: 55 }),
  );
  assert.equal(circleResult.map.obstacles[1].r, 55);
});

test('SetObstacleGeometry can be re-aimed while dragging', () => {
  const map = mapWithContent();
  const command = new SetObstacleGeometry('a', { x: 100, y: 100, w: 50, h: 50 }, { x: 100, y: 100, w: 50, h: 50 });
  command.setAfter({ x: 140, y: 100, w: 50, h: 50 });
  command.do(map);
  command.setAfter({ x: 180, y: 100, w: 50, h: 50 });
  command.do(map);
  assert.equal(map.obstacles[0].x, 180);
  command.undo(map);
  assert.equal(map.obstacles[0].x, 100);
});

test('SetCoverHeight', () => {
  const { map } = roundTrip(() => new SetCoverHeight('a', 'high', 'low'));
  assert.equal(map.obstacles[0].height, 'low');
});

test('SetPlayerStart places, moves and removes the start', () => {
  const placed = roundTrip(() => new SetPlayerStart({ x: 100, y: 400, angle: 0 }, { x: 150, y: 200, angle: 1 }));
  assert.deepEqual(placed.map.playerStart, { x: 150, y: 200, angle: 1 });

  const removed = roundTrip(() => new SetPlayerStart({ x: 100, y: 400, angle: 0 }, null));
  assert.equal(removed.map.playerStart, null);

  const first = new SetPlayerStart(null, { x: 5, y: 5, angle: 0 });
  const map = makeMap({ playerStart: null });
  first.do(map);
  assert.deepEqual(map.playerStart, { x: 5, y: 5, angle: 0 });
  first.undo(map);
  assert.equal(map.playerStart, null);
});

test('AddSpawn / RemoveSpawn / SetSpawn', () => {
  const added = roundTrip(() => new AddSpawn(spawn('s3', 700, 300)));
  assert.equal(added.map.spawns.at(-1).id, 's3');

  const removed = roundTrip(() => new RemoveSpawn('s1'));
  assert.deepEqual(removed.map.spawns.map((s) => s.id), ['s2']);

  const moved = roundTrip(
    () => new SetSpawn('s2', { x: 800, y: 500, angle: 0 }, { x: 750, y: 520, angle: 2 }),
  );
  assert.deepEqual([moved.map.spawns[1].x, moved.map.spawns[1].y, moved.map.spawns[1].angle], [750, 520, 2]);
});

test('ClearMap empties everything and undo brings it all back', () => {
  const { map } = roundTrip(() => new ClearMap());
  assert.deepEqual([map.obstacles, map.spawns, map.playerStart], [[], [], null]);
});
