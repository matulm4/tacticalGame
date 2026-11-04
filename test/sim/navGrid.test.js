import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NavGrid } from '../../src/sim/ai/nav/NavGrid.js';
import { NodeRegistry } from '../../src/sim/ai/nav/NodeRegistry.js';
import { PathFollower } from '../../src/sim/ai/nav/PathFollower.js';
import { smoothPath } from '../../src/sim/ai/nav/pathSmoothing.js';
import { StaticWorld } from '../../src/sim/map/StaticWorld.js';
import { makeMap, rect } from '../../test-support/sim.js';

const gridWith = (obstacles = []) => new NavGrid(new StaticWorld(makeMap({ obstacles })));
const pathLength = (path) => path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0);

/** Every straight piece of a path must be walkable. */
function assertWalkable(grid, path) {
  for (let i = 1; i < path.length; i++) {
    assert.ok(grid.clearLine(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y), `segment ${i} is blocked`);
  }
}

// ---- the grid ----------------------------------------------------------------

test('cells near walls and the map edge are blocked, open ground is free', () => {
  const grid = gridWith([rect('wall', 400, 300, 40, 200)]);
  assert.equal(grid.isBlocked(0, 0), true, 'a corner cell is too close to the edge');
  assert.equal(grid.isBlocked(grid.cols + 5, 0), true, 'outside the grid counts as blocked');
  const inside = grid.cellOf(420, 400);
  assert.equal(grid.isBlocked(inside.col, inside.row), true);
  const open = grid.cellOf(200, 200);
  assert.equal(grid.isBlocked(open.col, open.row), false);
});

test('nearestFree finds the closest free cell', () => {
  const grid = gridWith([rect('wall', 400, 300, 40, 200)]);
  const blocked = grid.cellOf(420, 400);
  const free = grid.nearestFree(blocked.col, blocked.row);
  assert.equal(grid.isBlocked(free.col, free.row), false);
  assert.ok(Math.abs(free.col - blocked.col) <= 4);
});

test('clearLine is true in the open and false through a wall', () => {
  const grid = gridWith([rect('wall', 400, 300, 40, 200)]);
  assert.equal(grid.clearLine(100, 100, 700, 100), true);
  assert.equal(grid.clearLine(100, 400, 700, 400), false);
});

// ---- finding paths -----------------------------------------------------------

test('in the open, the path is a straight line', () => {
  const grid = gridWith();
  const path = grid.findPath({ x: 100, y: 100 }, { x: 900, y: 700 });
  assert.deepEqual(path, [{ x: 100, y: 100 }, { x: 900, y: 700 }]);
});

test('the path goes around a wall, starts and ends exactly, and is walkable', () => {
  const grid = gridWith([rect('wall', 480, 0, 40, 600)]); // the only way round is below y = 600
  const from = { x: 100, y: 200 };
  const to = { x: 900, y: 200 };
  const path = grid.findPath(from, to);

  assert.deepEqual(path[0], from);
  assert.deepEqual(path.at(-1), to);
  assert.ok(path.length > 2);
  assert.ok(path.some((p) => p.y > 600), 'it passes through the gap');
  assertWalkable(grid, path);
  assert.ok(pathLength(path) > 800, 'longer than the blocked straight line');
});

test('no path into a sealed room', () => {
  const room = [
    rect('top', 600, 300, 200, 20),
    rect('bottom', 600, 500, 200, 20),
    rect('left', 600, 300, 20, 220),
    rect('right', 780, 300, 20, 220),
  ];
  const grid = gridWith(room);
  assert.equal(grid.findPath({ x: 100, y: 100 }, { x: 700, y: 410 }), null);
  assert.ok(grid.findPath({ x: 100, y: 100 }, { x: 900, y: 700 }), 'elsewhere is fine');
});

test('a goal inside a wall leads to the nearest spot outside it', () => {
  const grid = gridWith([rect('block', 500, 300, 100, 100)]);
  const path = grid.findPath({ x: 100, y: 100 }, { x: 550, y: 350 });
  const end = path.at(-1);
  assert.ok(grid.world.circleFits(end.x, end.y, 18), 'the route ends somewhere an agent can stand');
  assert.ok(Math.hypot(end.x - 550, end.y - 350) < 120);
  assertWalkable(grid, path);
});

test('an agent pressed against a wall can still find a way out', () => {
  const grid = gridWith([rect('wall', 480, 0, 40, 600)]);
  const path = grid.findPath({ x: 460, y: 300 }, { x: 900, y: 200 }); // 20 from the wall: inside the blocked margin
  assert.ok(path);
  assert.deepEqual(path[0], { x: 460, y: 300 });
  assert.deepEqual(path.at(-1), { x: 900, y: 200 });
});

test('a path from a place to itself is just that place', () => {
  const path = gridWith().findPath({ x: 300, y: 300 }, { x: 300, y: 300 });
  assert.equal(path.length, 2);
  assert.deepEqual(path[0], path[1]);
});

test('paths are the same every time', () => {
  const grid = gridWith([rect('wall', 480, 0, 40, 600)]);
  const find = () => grid.findPath({ x: 100, y: 200 }, { x: 900, y: 200 });
  assert.deepEqual(find(), find());
});

// ---- smoothing ---------------------------------------------------------------

test('smoothing jumps to the farthest waypoint that can be reached in a line', () => {
  const points = [0, 1, 2, 3, 4].map((x) => ({ x, y: 0 }));
  assert.deepEqual(smoothPath(points, () => true), [points[0], points[4]]);
  assert.deepEqual(smoothPath(points, () => false), points);
  // Only waypoints two apart can see each other:
  const seen = smoothPath(points, (a, b) => b.x - a.x <= 2);
  assert.deepEqual(seen.map((p) => p.x), [0, 2, 4]);
});

test('very short paths are left alone', () => {
  const two = [{ x: 0, y: 0 }, { x: 5, y: 5 }];
  assert.equal(smoothPath(two, () => false), two);
});

// ---- following ---------------------------------------------------------------

const L_PATH = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];

test('the follower heads for the next waypoint, then the next, then arrives', () => {
  const follower = new PathFollower(L_PATH, { arriveRadius: 18 });
  const agent = { x: 0, y: 0 };

  let step = follower.step(agent, 0.016);
  assert.deepEqual([step.dirX, step.dirY, step.arrived], [1, 0, false]);

  agent.x = 95; // within the waypoint radius of (100, 0), so it now heads for (100, 100)
  step = follower.step(agent, 0.016);
  assert.ok(step.dirY > 0.99 && Math.abs(step.dirX) < 0.06, `heading ${step.dirX}, ${step.dirY}`);

  agent.x = 100;
  agent.y = 90; // within 18 of the final point
  step = follower.step(agent, 0.016);
  assert.deepEqual([step.dirX, step.dirY, step.arrived], [0, 0, true]);
});

test('the follower notices an agent that is not getting anywhere', () => {
  const follower = new PathFollower(L_PATH);
  const agent = { x: 0, y: 0 };
  let stuck = false;
  for (let i = 0; i < 40; i++) stuck ||= follower.step(agent, 1 / 60).stuck; // 0.67 s without moving
  assert.equal(stuck, true);
});

test('an agent that keeps moving is never stuck', () => {
  const follower = new PathFollower([{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
  const agent = { x: 0, y: 0 };
  for (let i = 0; i < 120; i++) {
    agent.x += 3;
    assert.equal(follower.step(agent, 1 / 60).stuck, false);
  }
});

// ---- nodes -------------------------------------------------------------------

test('nodes get handles from 1, and 0 means none', () => {
  const nodes = new NodeRegistry();
  assert.equal(nodes.add({ x: 10, y: 10, kind: 'home' }), 1);
  assert.equal(nodes.add({ x: 200, y: 200, kind: 'cover' }), 2);
  assert.deepEqual(nodes.get(2), { x: 200, y: 200, kind: 'cover' });
  assert.equal(nodes.get(0), null);
  assert.equal(nodes.get(99), null);
});

test('nodes can carry extra data, and addOnce registers a node only once', () => {
  const nodes = new NodeRegistry();
  const handle = nodes.addOnce('cover:a', { x: 5, y: 5, kind: 'cover', cover: { id: 'a' } });
  assert.equal(nodes.addOnce('cover:a', { x: 5, y: 5, kind: 'cover', cover: { id: 'a' } }), handle);
  assert.equal(nodes.addOnce('cover:b', { x: 9, y: 9, kind: 'cover', cover: { id: 'b' } }), handle + 1);
  assert.deepEqual(nodes.get(handle).cover, { id: 'a' });
});

test('nodeNear returns the closest node within the radius', () => {
  const nodes = new NodeRegistry();
  nodes.add({ x: 0, y: 0, kind: 'a' });
  nodes.add({ x: 30, y: 0, kind: 'b' });
  assert.equal(nodes.nodeNear(5, 0, 28), 1);
  assert.equal(nodes.nodeNear(25, 0, 28), 2);
  assert.equal(nodes.nodeNear(500, 500, 28), 0);
});
