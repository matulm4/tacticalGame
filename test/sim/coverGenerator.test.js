import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCover } from '../../src/sim/ai/cover/CoverGenerator.js';
import { NavGrid } from '../../src/sim/ai/nav/NavGrid.js';
import { StaticWorld } from '../../src/sim/map/StaticWorld.js';
import { circle, makeMap, rect } from '../../test-support/sim.js';

function coverFor(obstacles) {
  const world = new StaticWorld(makeMap({ obstacles }));
  const nav = new NavGrid(world);
  return { world, nav, nodes: generateCover(world, nav) };
}

/** Distance from a point to the edge of a rectangle obstacle. */
const distanceToRect = (node, { x, y, w, h }) =>
  Math.hypot(Math.max(x - node.x, 0, node.x - (x + w)), Math.max(y - node.y, 0, node.y - (y + h)));

test('a rectangle gets cover positions on all four sides, 24 units out', () => {
  const crate = rect('crate', 400, 300, 120, 80);
  const { nodes } = coverFor([crate]);

  assert.ok(nodes.length >= 12);
  for (const node of nodes) {
    assert.equal(node.obstacleId, 'crate');
    assert.ok(Math.abs(distanceToRect(node, crate) - 24) < 1e-6, `${node.id} is ${distanceToRect(node, crate)} away`);
  }
  // each side is covered
  assert.ok(nodes.some((n) => n.ny === -1), 'above');
  assert.ok(nodes.some((n) => n.ny === 1), 'below');
  assert.ok(nodes.some((n) => n.nx === -1), 'left');
  assert.ok(nodes.some((n) => n.nx === 1), 'right');
});

test('a circle gets a ring of cover positions', () => {
  const pillar = circle('pillar', 500, 400, 40);
  const { nodes } = coverFor([pillar]);

  assert.ok(nodes.length >= 6);
  for (const node of nodes) {
    assert.ok(Math.abs(Math.hypot(node.x - 500, node.y - 400) - 64) < 1e-6, 'a radius plus 24 from the center');
  }
});

test('normals are unit vectors pointing away from the obstacle', () => {
  const { nodes } = coverFor([circle('pillar', 500, 400, 40), rect('crate', 100, 100, 60, 60)]);
  for (const node of nodes) assert.ok(Math.abs(Math.hypot(node.nx, node.ny) - 1) < 1e-9);
  const ring = nodes.find((n) => n.obstacleId === 'pillar');
  assert.ok((ring.x - 500) * ring.nx + (ring.y - 400) * ring.ny > 0, 'points outward');
});

test('every position is somewhere an agent can stand', () => {
  const { world, nav, nodes } = coverFor([
    rect('wall', 400, 100, 40, 500),
    circle('pillar', 700, 400, 50),
    rect('crate', 100, 100, 60, 60),
  ]);
  for (const node of nodes) assert.ok(world.circleFits(node.x, node.y, nav.clearance), node.id);
});

test('positions that would be inside another wall or off the map are dropped', () => {
  // A wall against the left edge: nothing fits to its left, and two walls close together leave no gap to stand in.
  const { nodes } = coverFor([rect('edge', 0, 200, 40, 300), rect('a', 400, 300, 40, 200), rect('b', 470, 300, 40, 200)]);
  assert.ok(!nodes.some((n) => n.obstacleId === 'edge' && n.nx === -1), 'the map edge side is dropped');
  assert.ok(!nodes.some((n) => n.obstacleId === 'a' && n.nx === 1 && n.y > 320 && n.y < 480), 'the 30-unit gap is too narrow');
});

test('positions never crowd each other, and ids are unique', () => {
  const { nodes } = coverFor([rect('crate', 400, 300, 120, 80), circle('pillar', 700, 400, 40), rect('wall', 100, 600, 500, 40)]);
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      assert.ok(Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) >= 20);
    }
  }
});

test('the height of the obstacle is kept (low cover and high cover are different)', () => {
  const { nodes } = coverFor([rect('high', 100, 100, 80, 80, 'high'), rect('low', 600, 100, 80, 80, 'low')]);
  assert.ok(nodes.filter((n) => n.obstacleId === 'high').every((n) => n.height === 'high'));
  assert.ok(nodes.filter((n) => n.obstacleId === 'low').every((n) => n.height === 'low'));
});

test('a map with no obstacles has no cover', () => {
  assert.deepEqual(coverFor([]).nodes, []);
});
