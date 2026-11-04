import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../../src/sim/world/Simulation.js';
import { ofType, makeMap, rect, run, spawn } from '../../test-support/sim.js';

test('every enemy spawn becomes an agent, the player stays the player', () => {
  const sim = new Simulation(
    makeMap({ spawns: [spawn('s1', 800, 300, { angle: Math.PI }), spawn('s2', 800, 500)] }),
    { seed: 1 },
  );
  const { agents, player } = sim.world;

  assert.equal(agents.length, 3);
  assert.equal(player.typeId, 'player');
  const enemies = agents.filter((agent) => agent !== player);
  assert.deepEqual(enemies.map((e) => [e.typeId, e.team, e.x, e.y]), [
    ['grunt', 'enemy', 800, 300],
    ['grunt', 'enemy', 800, 500],
  ]);
  assert.equal(enemies[0].aimAngle, Math.PI);
  assert.equal(enemies[0].hp, 1, 'enemies die in one hit');
  assert.equal(enemies[0].maxHp, 1);
});

test('spawning announces every agent', () => {
  const sim = new Simulation(makeMap({ spawns: [spawn('s1', 800, 300)] }), { seed: 1 });
  assert.equal(ofType(sim.drainEvents(), 'agentSpawned').length, 2);
});

test('a spawn inside a wall is pushed out', () => {
  const sim = new Simulation(
    makeMap({ obstacles: [rect('wall', 780, 280, 40, 40)], spawns: [spawn('s1', 800, 300)] }),
    { seed: 1 },
  );
  const enemy = sim.world.agents[1];
  assert.ok(sim.world.static.circleFits(enemy.x, enemy.y, enemy.def.radius));
});

test('an unknown enemy type is rejected', () => {
  assert.throws(
    () => new Simulation(makeMap({ spawns: [spawn('s1', 800, 300, { type: 'dragon' })] })),
    /Unknown agent type "dragon"/,
  );
});

test('the spawn team overrides the archetype team', () => {
  const sim = new Simulation(makeMap({ spawns: [spawn('s1', 800, 300, { team: 'rebels' })] }), { seed: 1 });
  assert.equal(sim.world.agents[1].team, 'rebels');
});

test('enemies are given the brain their archetype names, posted where they spawned', () => {
  const sim = new Simulation(makeMap({ spawns: [spawn('s1', 800, 300, { angle: 1 })] }), { seed: 1 });
  const enemy = sim.world.agents[1];

  assert.equal(enemy.controller.constructor.name, 'AIController');
  assert.deepEqual(
    { x: enemy.controller.brain.home.x, y: enemy.controller.brain.home.y, angle: enemy.controller.brain.home.angle },
    { x: 800, y: 300, angle: 1 },
  );
  assert.equal(sim.world.player.controller.constructor.name, 'PlayerController');
});

test('a spawned enemy can be shot dead by the player', () => {
  const sim = new Simulation(makeMap({ spawns: [spawn('s1', 500, 400, { type: 'sentry' })] }), { seed: 1 });
  const enemy = sim.world.agents[1];
  const events = run(sim, 120, (i) => ({ fire: i < 20 }));

  assert.deepEqual([enemy.x, enemy.y], [500, 400]);
  assert.equal(enemy.alive, false);
  assert.equal(ofType(events, 'agentDied').length, 1);
});
