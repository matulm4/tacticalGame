import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDamage } from '../../src/sim/systems/damageSystem.js';
import { Simulation } from '../../src/sim/world/Simulation.js';
import { makeMap, ofType, run, spawn } from '../../test-support/sim.js';

const twoEnemies = () => new Simulation(makeMap({ spawns: [spawn('a', 800, 300), spawn('b', 800, 500)] }), { seed: 1 });
const enemiesOf = (sim) => sim.world.agents.filter((agent) => agent !== sim.world.player);
const kill = (sim, agent) => applyDamage(sim.world, agent, agent.hp, null);
const outcomes = (events) => ofType(events, 'matchEnded').map((event) => event.outcome);

test('killing every enemy wins, and the win is announced once', () => {
  const sim = twoEnemies();
  const [a, b] = enemiesOf(sim);

  kill(sim, a);
  assert.deepEqual(outcomes(run(sim, 5)), [], 'one enemy is still alive');
  assert.equal(sim.world.result, null);

  kill(sim, b);
  const events = run(sim, 5);
  assert.deepEqual(outcomes(events), ['win']);
  assert.deepEqual(sim.world.result, { outcome: 'win' });

  assert.deepEqual(outcomes(run(sim, 60)), [], 'not announced again');
});

test('dying loses', () => {
  const sim = twoEnemies();
  applyDamage(sim.world, sim.world.player, 3, null);
  assert.deepEqual(outcomes(run(sim, 3)), ['lose']);
  assert.deepEqual(sim.world.result, { outcome: 'lose' });
});

test('if everyone dies at once, the player still loses', () => {
  const sim = twoEnemies();
  for (const agent of sim.world.agents) kill(sim, agent);
  assert.deepEqual(outcomes(run(sim, 3)), ['lose']);
});

test('a map without enemies is a sandbox: nothing to win, so no instant victory', () => {
  const sim = new Simulation(makeMap(), { seed: 1 });
  assert.deepEqual(outcomes(run(sim, 120)), []);
  assert.equal(sim.world.result, null);

  applyDamage(sim.world, sim.world.player, 3, null); // losing still applies
  assert.deepEqual(outcomes(run(sim, 3)), ['lose']);
});

test('restarting starts a fresh match', () => {
  const sim = twoEnemies();
  for (const enemy of enemiesOf(sim)) kill(sim, enemy);
  run(sim, 3);
  assert.ok(sim.world.result);

  sim.restart();
  assert.equal(sim.world.result, null);
  assert.equal(enemiesOf(sim).filter((agent) => agent.alive).length, 2);

  for (const enemy of enemiesOf(sim)) kill(sim, enemy);
  assert.deepEqual(outcomes(run(sim, 3)), ['win'], 'the rule is armed again');
});

test('the game mode can be swapped', () => {
  let updates = 0;
  const sim = new Simulation(makeMap(), {
    createRule: () => ({ start() {}, update: () => updates++ }),
  });
  run(sim, 10);
  assert.equal(updates, 10);
});
