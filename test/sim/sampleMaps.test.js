import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lintMap } from '../../src/editor/mapLint.js';
import { validateMap } from '../../src/sim/map/mapSchema.js';
import { Simulation } from '../../src/sim/world/Simulation.js';
import { NEUTRAL_PLAYER_INPUT } from '../../src/sim/controllers/PlayerController.js';

const load = (file) => JSON.parse(readFileSync(new URL(`../../maps/${file}`, import.meta.url), 'utf8'));
const index = load('index.json');

for (const { name, file } of index.maps) {
  test(`sample map "${name}" is valid and has no lint problems`, () => {
    const map = load(file);
    assert.equal(validateMap(map).ok, true);
    const problems = lintMap(map).filter((issue) => issue.message !== 'No enemy spawns yet.'); // Arena is a sandbox
    assert.deepEqual(problems, []);
  });
}

test('Crossfire shows the whole squad cycle: cover, leapfrogging advances, then a search', () => {
  const sim = new Simulation(load('crossfire.json'), { seed: 3 });
  const { player } = sim.world;
  player.hp = player.maxHp = 1000;
  player.x = 880;
  player.y = 230;

  const started = [];
  for (let tick = 0; tick < 30 * 60; tick++) {
    if (sim.world.time > 15) {
      player.x = 150; // the player slips away
      player.y = 500;
    }
    sim.setPlayerInput({ ...NEUTRAL_PLAYER_INPUT, aimX: 1600, aimY: 230 });
    sim.step();
    for (const e of sim.drainEvents()) if (e.type === 'squadBehavior' && e.phase === 'started') started.push(e.behavior);
  }

  assert.equal(started[0], 'getToCover');
  assert.ok(started.filter((b) => b === 'advance').length >= 2, started.join());
  assert.ok(started.includes('search'), started.join());
});
