import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_TYPES } from '../../src/sim/defs/agentTypes.js';
import { addDummy, circle, makeSim, ofType, rect, run } from '../../test-support/sim.js';

const R = AGENT_TYPES.player.radius;
const near = (a, b, eps) => Math.abs(a - b) <= eps;

test('walks at the archetype speed', () => {
  const sim = makeSim();
  run(sim, 60, { moveX: 1 });
  assert.ok(near(sim.world.player.x, 100 + 190, 1), `x ${sim.world.player.x}`);
});

test('diagonal movement is not faster than straight', () => {
  const sim = makeSim();
  run(sim, 60, { moveX: 1, moveY: 1 });
  const { x, y } = sim.world.player;
  assert.ok(near(Math.hypot(x - 100, y - 400), 190, 1));
});

test('crouching halves the speed', () => {
  const sim = makeSim();
  run(sim, 60, { moveX: 1, crouch: true });
  assert.ok(near(sim.world.player.x, 100 + 95, 1), `x ${sim.world.player.x}`);
});

test('walls stop the player', () => {
  const sim = makeSim({ obstacles: [rect('wall', 200, 300, 20, 200)] });
  run(sim, 120, { moveX: 1 });
  assert.ok(near(sim.world.player.x, 200 - R, 0.01), `x ${sim.world.player.x}`);
});

test('the player slides along a wall when moving diagonally into it', () => {
  const sim = makeSim({ obstacles: [rect('wall', 200, 300, 20, 400)] });
  run(sim, 60, { moveX: 1, moveY: 1 });
  const { x, y } = sim.world.player;
  assert.ok(x <= 200 - R + 0.01);
  assert.ok(y > 400 + 50, `y ${y}`);
});

test('round obstacles stop the player too', () => {
  const sim = makeSim({ obstacles: [circle('pillar', 300, 400, 40)] });
  run(sim, 120, { moveX: 1 });
  assert.ok(near(sim.world.player.x, 300 - 40 - R, 0.01));
});

test('the arena edge stops the player', () => {
  const sim = makeSim();
  run(sim, 120, { moveX: -1 });
  assert.equal(sim.world.player.x, R);
});

test('walking emits footstep sounds, quieter when crouched, none when still', () => {
  const walking = ofType(run(makeSim(), 60, { moveX: 1 }), 'soundEmitted');
  assert.equal(walking.length, 3); // 190 units / 56 per step
  assert.ok(walking.every((e) => e.kind === 'footstep' && e.radius === 140 && e.team === 'player'));

  const crouched = ofType(run(makeSim(), 60, { moveX: 1, crouch: true }), 'soundEmitted');
  assert.equal(crouched.length, 1); // 95 units
  assert.equal(crouched[0].radius, 60);

  assert.equal(ofType(run(makeSim(), 30), 'soundEmitted').length, 0);
});

test('overlapping agents are pushed apart', () => {
  const sim = makeSim();
  const dummy = addDummy(sim, { x: 105, y: 400 });
  run(sim, 1);
  const gap = Math.hypot(dummy.x - sim.world.player.x, dummy.y - sim.world.player.y);
  assert.ok(gap >= R + 14 - 1e-6, `gap ${gap}`); // the dummy's radius is 14
});
