import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findCover, isValidCover, peekPoint, sightRange } from '../../src/sim/ai/cover/CoverQuery.js';
import { AGENT_TYPES } from '../../src/sim/defs/agentTypes.js';
import { makeSim, rect, spawn } from '../../test-support/sim.js';

// A crate stands at x 520..560, y 300..500. The threat (the player) is west of it at (200, 400).
const THREAT = { id: 1, x: 200, y: 400 };

function setup({ height = 'high', crate = rect('crate', 520, 300, 40, 200, height), enemyAt = [500, 400] } = {}) {
  const sim = makeSim({ obstacles: [crate], spawns: [spawn('e', enemyAt[0], enemyAt[1], { angle: Math.PI })] });
  const [player, enemy] = sim.world.agents;
  player.x = THREAT.x;
  player.y = THREAT.y;
  return { world: sim.world, player, enemy };
}

const nodesOf = (world, predicate) => world.cover.nodes.filter(predicate);
const eastOf = (n) => n.x > 560;
/** A cover position in the middle of the crate's east face (y 380 or 420). */
const midEast = (world) => world.cover.nodes.find((n) => n.x > 560 && Math.abs(n.y - 400) <= 20);
const westOf = (n) => n.x < 520;
const northOf = (n) => n.y < 300;

test('cover on the far side of a wall is valid; on the near side or the flank it is not', () => {
  const { world } = setup();
  assert.ok(nodesOf(world, eastOf).filter((n) => n.y > 310 && n.y < 490).every((n) => isValidCover(world, n, THREAT)));
  assert.ok(nodesOf(world, westOf).every((n) => !isValidCover(world, n, THREAT)), 'facing the threat');
  assert.ok(nodesOf(world, northOf).every((n) => !isValidCover(world, n, THREAT)), 'out on the flank');
});

test('low cover hides a crouched agent, so it is valid too', () => {
  const { world } = setup({ height: 'low' });
  assert.ok(nodesOf(world, eastOf).filter((n) => n.y > 310 && n.y < 490).every((n) => isValidCover(world, n, THREAT)));
});

test('cover only counts when the wall the position is behind is the one in the way', () => {
  // A node on the crate's near side is hidden from the threat by a different wall (the screen),
  // not by the crate it stands beside, so it is not "cover behind the crate".
  const sim = makeSim({
    obstacles: [rect('crate', 520, 300, 40, 200), rect('screen', 360, 300, 20, 200)],
    spawns: [spawn('e', 500, 400, { angle: Math.PI })],
  });
  const nearSide = sim.world.cover.nodes.find((n) => n.obstacleId === 'crate' && n.x < 520 && Math.abs(n.y - 400) <= 20);

  assert.equal(sim.world.static.segmentBlocked(nearSide.x, nearSide.y, THREAT.x, THREAT.y, { sourceCrouched: true }), true, 'it is hidden');
  assert.equal(isValidCover(sim.world, nearSide, THREAT), false, 'but not by its own wall');
});

test('behind low cover an agent peeks by standing up, if the threat stands', () => {
  const { world } = setup({ height: 'low' });
  const node = midEast(world);
  const peek = peekPoint(world, node, THREAT, false);
  assert.deepEqual([peek.x, peek.y, peek.distance], [node.x, node.y, 0]);
});

test('behind low cover there is no peek at a crouched threat (it is hidden too)', () => {
  const { world } = setup({ height: 'low' });
  const node = midEast(world);
  assert.equal(peekPoint(world, node, THREAT, true), null);
});

test('behind high cover an agent peeks by stepping along the wall past its end', () => {
  const { world } = setup();
  const node = midEast(world);
  const peek = peekPoint(world, node, THREAT, false);

  assert.ok(peek, 'there is a spot within 120 units');
  assert.ok(peek.distance > 0 && peek.distance <= 120);
  assert.equal(peek.x, node.x, 'it moved along the wall, not away from it');
  assert.ok(peek.y < 300 || peek.y > 500, 'past the end of the crate');
  assert.equal(world.static.segmentBlocked(peek.x, peek.y, THREAT.x, THREAT.y, {}), false, 'and can see the threat from there');
});

test('no peek when the wall is too long to see past', () => {
  const { world } = setup({ crate: rect('long', 520, 50, 40, 700) });
  const node = midEast(world);
  assert.equal(peekPoint(world, node, THREAT, false), null);
});

test('a peek spot the agent could not see the threat from (too far) does not count', () => {
  const { world } = setup();
  const node = midEast(world);
  assert.ok(peekPoint(world, node, THREAT, false, 1000));
  assert.equal(peekPoint(world, node, THREAT, false, 200), null);
});

test('sight range is shorter against a crouched target', () => {
  assert.equal(sightRange(AGENT_TYPES.grunt, false), 450);
  assert.equal(sightRange(AGENT_TYPES.grunt, true), 225);
});

test('findCover picks real cover within reach, with somewhere to peek from', () => {
  const { world, enemy } = setup();
  const found = findCover({ agent: enemy, world }, THREAT);

  assert.ok(found);
  assert.equal(found.node.obstacleId, 'crate');
  assert.ok(found.node.x > 560, 'behind the crate, away from the threat');
  assert.ok(isValidCover(world, found.node, THREAT));
  assert.ok(found.peek);
});

test('findCover returns nothing when there is no cover, or it is all too far', () => {
  const bare = makeSim({ spawns: [spawn('e', 500, 400, { angle: Math.PI })] });
  assert.equal(findCover({ agent: bare.world.agents[1], world: bare.world }, THREAT), null);

  const { world, enemy } = setup();
  enemy.x = 100;
  enemy.y = 700; // the crate is more than 450 units away
  assert.equal(findCover({ agent: enemy, world }, THREAT), null);
});

test('findCover ignores cover from which the threat could not be seen at all', () => {
  const { world, enemy } = setup();
  const far = { id: 1, x: 5, y: 400 }; // the far side of the crate is 570 from here: beyond sight range
  assert.equal(findCover({ agent: enemy, world }, far), null);
});

test('findCover ignores cover right on top of the threat', () => {
  const { world, enemy } = setup();
  const close = { id: 1, x: 585, y: 400 }; // standing right where the cover is
  const found = findCover({ agent: enemy, world }, close);
  assert.ok(!found || Math.hypot(found.node.x - close.x, found.node.y - close.y) >= 80);
});

test('findCover skips cover with no walkable route', () => {
  const { world, enemy } = setup();
  const realNav = world.nav;
  assert.ok(findCover({ agent: enemy, world }, THREAT), 'normally there is cover');

  world.nav = { clearance: realNav.clearance, clearLine: (...a) => realNav.clearLine(...a), findPath: () => null };
  assert.equal(findCover({ agent: enemy, world }, THREAT), null);
});
