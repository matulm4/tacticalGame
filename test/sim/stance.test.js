import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_TYPES } from '../../src/sim/defs/agentTypes.js';
import { agentRadius } from '../../src/sim/entities/Agent.js';
import { makeSim, ofType, rect, run } from '../../test-support/sim.js';

const R = AGENT_TYPES.player.radius; // standing radius
const CR = R * AGENT_TYPES.player.crouchRadiusMult; // crouched radius

const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;

test('crouching shrinks the body and standing restores it', () => {
  const sim = makeSim();
  const player = sim.world.player;
  assert.equal(agentRadius(player), R);

  const down = run(sim, 1, { crouch: true });
  assert.equal(player.crouched, true);
  assert.ok(near(agentRadius(player), CR, 1e-9));
  assert.deepEqual(ofType(down, 'stanceChanged').map((e) => e.crouched), [true]);

  const up = run(sim, 1, { crouch: false });
  assert.equal(player.crouched, false);
  assert.equal(agentRadius(player), R);
  assert.deepEqual(ofType(up, 'stanceChanged').map((e) => e.crouched), [false]);
});

test('a crouched agent stays crouched in a gap too narrow to stand in', () => {
  // A crouched body (2 * CR across) fits the gap, a standing one (2 * R) does not.
  const gap = 1.7 * R;
  const sim = makeSim({
    obstacles: [rect('top', 300, 300, 200, 400 - gap / 2 - 300), rect('bottom', 300, 400 + gap / 2, 200, 100)],
  });
  const player = sim.world.player;
  player.x = 400;
  player.y = 400;
  player.crouched = true;

  const events = run(sim, 5, { crouch: false });
  assert.equal(player.crouched, true);
  assert.equal(ofType(events, 'stanceChanged').length, 0);

  player.x = 700; // open ground
  run(sim, 1, { crouch: false });
  assert.equal(player.crouched, false);
});

test('standing up flush against a wall nudges the player clear instead of refusing', () => {
  const sim = makeSim({ obstacles: [rect('wall', 300, 200, 20, 400)] });
  const player = sim.world.player;

  run(sim, 200, { moveX: 1, crouch: true });
  assert.ok(near(player.x, 300 - CR), `crouched x ${player.x}`);

  run(sim, 1, { crouch: false });
  assert.equal(player.crouched, false);
  assert.ok(near(player.x, 300 - R), `standing x ${player.x}`);
  assert.ok(near(player.y, 400));
});

test('standing up in a corner works too', () => {
  const sim = makeSim({
    obstacles: [rect('east', 300, 100, 20, 400), rect('south', 100, 420, 400, 20)],
  });
  const player = sim.world.player;

  run(sim, 300, { moveX: 1, moveY: 1, crouch: true });
  assert.ok(near(player.x, 300 - CR) && near(player.y, 420 - CR), `crouched at ${player.x}, ${player.y}`);

  run(sim, 1, { crouch: false });
  assert.equal(player.crouched, false);
  assert.ok(near(player.x, 300 - R) && near(player.y, 420 - R), `standing at ${player.x}, ${player.y}`);
});

test('standing up against the arena edge works', () => {
  const sim = makeSim();
  const player = sim.world.player;

  run(sim, 200, { moveX: -1, crouch: true });
  assert.ok(near(player.x, CR));

  run(sim, 1, { crouch: false });
  assert.equal(player.crouched, false);
  assert.ok(near(player.x, R));
});
