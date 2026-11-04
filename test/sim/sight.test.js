import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEG } from '../../src/core/math.js';
import { canSee, visibleHostiles } from '../../src/sim/ai/perception/SightSensor.js';
import { selectTarget } from '../../src/sim/ai/perception/TargetSelector.js';
import { visionPolygon } from '../../src/sim/ai/perception/visionPolygon.js';
import { visionCones } from '../../src/sim/debug/DebugProbe.js';
import { addDummy, makeSim, rect, spawn } from '../../test-support/sim.js';

// The grunt has a 110 degree view cone, sees a standing target out to 450 and a
// crouched one out to 225. By default the enemy stands at (400, 400) facing -x
// at the player, who stands at (100, 400): 300 units away, dead ahead.
function setup({ obstacles = [], enemy = {}, player = {} } = {}) {
  const at = { x: 400, y: 400, angle: Math.PI, ...enemy };
  const sim = makeSim({ obstacles, spawns: [spawn('e', at.x, at.y, { angle: at.angle })] });
  const [playerAgent, enemyAgent] = sim.world.agents;
  Object.assign(playerAgent, { x: 100, y: 400, ...player });
  return { world: sim.world, player: playerAgent, enemy: enemyAgent };
}

test('sees a hostile that is in range, in the cone and in the open', () => {
  const { world, player, enemy } = setup();
  assert.equal(canSee(world, enemy, player), true);
});

test('does not see beyond its range', () => {
  const { world, player, enemy } = setup({ enemy: { x: 600 } }); // 500 away, range 450
  assert.equal(canSee(world, enemy, player), false);
});

test('does not see what is behind it, and the cone has edges', () => {
  const behind = setup({ enemy: { angle: 0 } });
  assert.equal(canSee(behind.world, behind.enemy, behind.player), false);

  // Half the cone is 55 degrees: 54 is inside, 56 is outside.
  const offAxis = (degrees) => {
    const scene = setup();
    const angle = Math.PI + degrees * DEG;
    scene.player.x = scene.enemy.x + Math.cos(angle) * 300;
    scene.player.y = scene.enemy.y + Math.sin(angle) * 300;
    return canSee(scene.world, scene.enemy, scene.player);
  };
  assert.equal(offAxis(54), true);
  assert.equal(offAxis(-54), true);
  assert.equal(offAxis(56), false);
  assert.equal(offAxis(-56), false);
});

test('a crouched target is only seen from half the distance', () => {
  const near = setup({ player: { crouched: true, x: 200 } }); // 200 away, crouched range 225
  assert.equal(canSee(near.world, near.enemy, near.player), true);

  const far = setup({ player: { crouched: true } }); // 300 away
  assert.equal(canSee(far.world, far.enemy, far.player), false);
  far.player.crouched = false;
  assert.equal(canSee(far.world, far.enemy, far.player), true);
});

test('a high wall blocks sight', () => {
  const { world, player, enemy } = setup({ obstacles: [rect('wall', 250, 300, 20, 200, 'high')] });
  assert.equal(canSee(world, enemy, player), false);
});

test('standing agents see each other over low cover', () => {
  const { world, player, enemy } = setup({ obstacles: [rect('wall', 250, 300, 20, 200, 'low')] });
  assert.equal(canSee(world, enemy, player), true);
});

test('low cover hides a crouched target, and blinds a crouched observer', () => {
  const wall = [rect('wall', 250, 300, 20, 200, 'low')];

  const hidden = setup({ obstacles: wall, player: { crouched: true, x: 200 } });
  assert.equal(canSee(hidden.world, hidden.enemy, hidden.player), false);

  const blinded = setup({ obstacles: wall });
  blinded.enemy.crouched = true;
  assert.equal(canSee(blinded.world, blinded.enemy, blinded.player), false);
});

test('only living hostiles are visible', () => {
  const { world, player, enemy } = setup();
  assert.deepEqual(visibleHostiles(world, enemy), [player]);

  player.alive = false;
  assert.deepEqual(visibleHostiles(world, enemy), []);
});

test('a friend in plain view is not a hostile, and does not block the view', () => {
  const scene = setup();
  const friend = addDummy({ world: scene.world }, { x: 300, y: 400 }); // same team as the enemy
  assert.deepEqual(visibleHostiles(scene.world, scene.enemy), [scene.player]);
  assert.ok(!visibleHostiles(scene.world, scene.enemy).includes(friend));
});

test('agents without vision data see nothing', () => {
  const { world, player, enemy } = setup();
  assert.equal(canSee(world, player, enemy), false, 'the player archetype has no vision');
});

test('target selection keeps the current target and otherwise takes the nearest', () => {
  const observer = { x: 0, y: 0 };
  const near = { id: 1, x: 50, y: 0 };
  const far = { id: 2, x: 200, y: 0 };

  assert.equal(selectTarget(observer, []), null);
  assert.equal(selectTarget(observer, [far, near]), near);
  assert.equal(selectTarget(observer, [far, near], 2), far, 'sticks to the current target while visible');
  assert.equal(selectTarget(observer, [far, near], 99), near, 'a vanished target is dropped');
});

test('the vision polygon is the full cone in the open', () => {
  const { world, enemy } = setup();
  const points = visionPolygon(world, enemy);
  assert.equal(points.length, 49);
  for (const point of points) {
    assert.ok(Math.abs(Math.hypot(point.x - enemy.x, point.y - enemy.y) - 450) < 1e-6);
  }
  // The outer rays sit at the edges of the cone.
  const edge = Math.atan2(points[0].y - enemy.y, points[0].x - enemy.x);
  assert.ok(Math.abs(Math.abs(edge - Math.PI) - 55 * DEG) < 1e-6);
});

test('a high wall cuts the vision polygon short', () => {
  const { world, enemy } = setup({ obstacles: [rect('wall', 250, 300, 20, 200, 'high')] });
  const points = visionPolygon(world, enemy);
  const reach = points.map((p) => Math.hypot(p.x - enemy.x, p.y - enemy.y));

  assert.ok(Math.min(...reach) < 160, 'rays hitting the wall stop at it');
  assert.ok(Math.max(...reach) <= 450 + 1e-6);
  assert.ok(reach.some((r) => Math.abs(r - 450) < 1e-6), 'rays that miss the wall keep their full length');
});

test('low cover cuts the polygon for a crouched observer but not a standing one', () => {
  const walls = [rect('wall', 250, 300, 20, 200, 'low')];
  const reachOf = (crouched) => {
    const { world, enemy } = setup({ obstacles: walls });
    enemy.crouched = crouched;
    return Math.min(...visionPolygon(world, enemy).map((p) => Math.hypot(p.x - enemy.x, p.y - enemy.y)));
  };
  assert.ok(Math.abs(reachOf(false) - 450) < 1e-6);
  assert.ok(reachOf(true) < 160);
});

test('the debug probe describes the cone of every agent that can see', () => {
  const { world, enemy } = setup();
  const cones = visionCones(world);

  assert.equal(cones.length, 1, 'the player has no vision');
  const [cone] = cones;
  assert.equal(cone.agentId, enemy.id);
  assert.equal(cone.range, 450);
  assert.equal(cone.crouchedRange, 225);
  assert.ok(Math.abs(cone.halfFov - 55 * DEG) < 1e-9);
  assert.equal(cone.polygon.length, 49);

  enemy.alive = false;
  assert.equal(visionCones(world).length, 0);
});
