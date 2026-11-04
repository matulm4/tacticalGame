import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Simulation } from '../../src/sim/world/Simulation.js';
import { createEmptyMap } from '../../src/sim/map/mapSchema.js';
import { makeMap, run } from '../../test-support/sim.js';

const arena = () => JSON.parse(fs.readFileSync(new URL('../../maps/arena.json', import.meta.url), 'utf8'));

test('the shipped arena map loads and the player starts in the open', () => {
  const sim = new Simulation(arena(), { seed: 1 });
  const player = sim.world.player;
  assert.deepEqual([player.x, player.y], [100, 500]);
  assert.equal(player.hp, 3);
  assert.ok(sim.world.static.circleFits(player.x, player.y, player.def.radius));
});

test('an invalid map or a map without a player start is rejected', () => {
  assert.throws(() => new Simulation({ version: 99 }), /Invalid map/);
  assert.throws(() => new Simulation(createEmptyMap()), /no player start/);
});

test('a player start inside a wall is pushed out', () => {
  const sim = new Simulation(
    makeMap({
      playerStart: { x: 150, y: 150, angle: 0 },
      obstacles: [{ id: 'w', shape: 'rect', x: 100, y: 100, w: 100, h: 100, height: 'high' }],
    }),
  );
  const { x, y, def } = sim.world.player;
  assert.ok(sim.world.static.circleFits(x, y, def.radius));
});

test('the same seed and inputs give identical event logs; another seed differs', () => {
  const script = (i) => ({
    moveX: i % 120 < 60 ? 1 : -1,
    fire: i % 40 < 25,
    crouch: i % 90 > 60,
    aimX: 900,
    aimY: 300 + (i % 50),
  });
  // A narrow arena, so bullets reach the edge and the hit position depends on the random spread.
  const log = (seed) => {
    const sim = new Simulation(makeMap(), { seed });
    return JSON.stringify(run(sim, 400, script));
  };

  assert.equal(log(5), log(5));
  assert.notEqual(log(5), log(6));
});

test('restart rebuilds the world', () => {
  const sim = new Simulation(arena(), { seed: 1 });
  run(sim, 120, { moveX: 1, fire: true });
  assert.notEqual(sim.world.player.x, 100);

  sim.restart();
  assert.equal(sim.world.tick, 0);
  assert.deepEqual([sim.world.player.x, sim.world.player.y], [100, 500]);
  assert.equal(sim.world.bullets.length, 0);
});

test('events carry the tick and simulated time they happened at', () => {
  const sim = new Simulation(makeMap(), { seed: 1 });
  const events = run(sim, 3, { fire: true });
  const shot = events.find((e) => e.type === 'shotFired');
  assert.equal(shot.tick, 1);
  assert.ok(Math.abs(shot.time - 1 / 60) < 1e-9);
});
