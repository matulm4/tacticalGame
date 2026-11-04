import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkingMemory } from '../../src/sim/ai/memory/WorkingMemory.js';
import { bulletsNearby, isAimedAt } from '../../src/sim/ai/perception/DangerSensor.js';
import { Perception } from '../../src/sim/ai/perception/Perception.js';
import { createBullet } from '../../src/sim/entities/Bullet.js';
import { makeSim, rect, spawn } from '../../test-support/sim.js';

// The enemy (me) stands at (400, 400); the player (the shooter) at (100, 400), aiming at it by default.
function setup({ obstacles = [], enemyAt = [400, 400] } = {}) {
  const sim = makeSim({ obstacles, spawns: [spawn('e', enemyAt[0], enemyAt[1], { angle: Math.PI })] });
  const [player, enemy] = sim.world.agents;
  player.x = 100;
  player.y = 400;
  player.aimAngle = 0;
  return { world: sim.world, player, enemy };
}

test('a gun pointed at someone, with a clear line, is aimed at them', () => {
  const { world, player, enemy } = setup();
  assert.equal(isAimedAt(world, enemy, player), true);
});

test('a gun pointed a little off still counts, a lot off does not', () => {
  const { world, player, enemy } = setup();
  player.aimAngle = 0.08; // 4.6 degrees at 300 units: still within the 6 degree tolerance
  assert.equal(isAimedAt(world, enemy, player), true);
  player.aimAngle = 0.3; // 17 degrees
  assert.equal(isAimedAt(world, enemy, player), false);
});

test('a wall in the way means nothing is aimed at it', () => {
  const { world, player, enemy } = setup({ obstacles: [rect('wall', 250, 300, 20, 200)] });
  assert.equal(isAimedAt(world, enemy, player), false);
});

test('too far away, or the same team, or a dead shooter, is not a threat', () => {
  const far = setup({ enemyAt: [900, 400] }); // 800 away
  assert.equal(isAimedAt(far.world, far.enemy, far.player), false);

  const { world, player, enemy } = setup();
  player.team = 'enemy';
  assert.equal(isAimedAt(world, enemy, player), false);
  player.team = 'player';
  player.alive = false;
  assert.equal(isAimedAt(world, enemy, player), false);
});

test('a hostile bullet passing close and heading our way is "fire"', () => {
  const { world, enemy } = setup();
  const bullet = (x, y, vx, team = 'player') =>
    createBullet({ id: 99, x, y, vx, vy: 0, ownerId: 1, team, damage: 1, ttl: 1, shooterCrouched: false, blind: false });

  world.bullets = [bullet(350, 405, 900)]; // 50 away, flying at us
  assert.equal(bulletsNearby(world, enemy), true);

  world.bullets = [bullet(350, 405, -900)]; // flying away
  assert.equal(bulletsNearby(world, enemy), false);

  world.bullets = [bullet(200, 400, 900)]; // heading our way but far off
  assert.equal(bulletsNearby(world, enemy), false);

  world.bullets = [bullet(350, 405, 900, 'enemy')]; // a friendly bullet
  assert.equal(bulletsNearby(world, enemy), false);
});

test('memory: "aimed at" fades after a moment, "under fire" after a couple of seconds', () => {
  const memory = new WorkingMemory();
  assert.equal(memory.isThreatened(10), false);
  assert.equal(memory.isUnderFire(10), false);

  memory.threatenedAt = 10;
  memory.underFireAt = 10;
  assert.equal(memory.isThreatened(10.5), true);
  assert.equal(memory.isThreatened(10.7), false);
  assert.equal(memory.isUnderFire(11.9), true);
  assert.equal(memory.isUnderFire(12.1), false);
});

test('perception notices a gun aimed at it only from someone it can see', () => {
  const seen = setup();
  const perception = new Perception();
  perception.update(seen.enemy, seen.world, 1 / 60);
  assert.equal(perception.memory.isThreatened(seen.world.time), true);

  // The player crouches where the enemy cannot see them (300 away, beyond the crouched range of 225): still aiming, but unnoticed.
  const unseen = setup();
  unseen.player.crouched = true;
  const blind = new Perception();
  blind.update(unseen.enemy, unseen.world, 1 / 60);
  assert.equal(blind.memory.target, null);
  assert.equal(blind.memory.isThreatened(unseen.world.time), false);
});

test('perception notices bullets going past on every tick', () => {
  const { world, enemy } = setup();
  const perception = new Perception();
  perception.update(enemy, world, 1 / 60); // the sight check is done; the next ticks skip it
  world.bullets = [createBullet({ id: 99, x: 360, y: 400, vx: 900, vy: 0, ownerId: 1, team: 'player', damage: 1, ttl: 1, shooterCrouched: false, blind: false })];
  world.time += 1 / 60;
  perception.update(enemy, world, 1 / 60);
  assert.equal(perception.memory.isUnderFire(world.time), true);
});
