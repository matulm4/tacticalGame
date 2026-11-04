import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiInfo } from '../../src/sim/debug/DebugProbe.js';
import { Simulation } from '../../src/sim/world/Simulation.js';
import { makeMap, run, spawn } from '../../test-support/sim.js';

const sim = () =>
  new Simulation(makeMap({ spawns: [spawn('a', 700, 300), spawn('b', 700, 500, { type: 'sentry' })] }), { seed: 1 });

test('aiInfo describes every living AI agent and nobody else', () => {
  const s = sim();
  run(s, 30);
  const infos = aiInfo(s.world);

  assert.equal(infos.length, 2, 'the player has no brain');
  for (const info of infos) {
    assert.ok(['goal', 'plan', 'step', 'state', 'path', 'target', 'lastKnown', 'x', 'y', 'agentId'].every((key) => key in info));
  }
  assert.equal(infos[0].goal, 'Idle');
  assert.deepEqual(infos[0].plan, ['LookAround']);
});

test('dead agents drop out of the overlay', () => {
  const s = sim();
  run(s, 5);
  s.world.agents[1].alive = false;
  assert.equal(aiInfo(s.world).length, 1);
});
