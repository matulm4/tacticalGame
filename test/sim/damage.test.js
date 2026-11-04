import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_TYPES } from '../../src/sim/defs/agentTypes.js';
import { applyDamage } from '../../src/sim/systems/damageSystem.js';
import { addDummy, makeAccurate, makeSim, ofType, run } from '../../test-support/sim.js';

test('the player has 3 hit points', () => {
  assert.equal(AGENT_TYPES.player.maxHp, 3);
});

test('an agent with 1 hp dies from one hit and takes no damage afterwards', () => {
  const sim = makeSim();
  const enemy = addDummy(sim, { x: 500, y: 400, hp: 1 });
  sim.drainEvents();

  applyDamage(sim.world, enemy, 1, 99);
  applyDamage(sim.world, enemy, 1, 99);

  const events = sim.drainEvents();
  assert.equal(enemy.hp, 0);
  assert.equal(enemy.alive, false);
  assert.equal(ofType(events, 'agentDamaged').length, 1);
  assert.deepEqual(ofType(events, 'agentDied').map((e) => [e.agentId, e.killerId]), [[enemy.id, 99]]);
});

test('the player survives two hits and dies on the third', () => {
  const sim = makeSim();
  const player = sim.world.player;

  applyDamage(sim.world, player, 1, 99);
  applyDamage(sim.world, player, 1, 99);
  assert.equal(player.hp, 1);
  assert.equal(player.alive, true);

  applyDamage(sim.world, player, 1, 99);
  assert.equal(player.hp, 0);
  assert.equal(player.alive, false);
});

test('hp is a counter: larger values and damage amounts work', () => {
  const sim = makeSim();
  const tank = addDummy(sim, { x: 500, y: 400, hp: 5 });
  applyDamage(sim.world, tank, 2, 1);
  assert.equal(tank.hp, 3);
  applyDamage(sim.world, tank, 10, 1);
  assert.equal(tank.hp, 0);
  assert.equal(tank.alive, false);
});

test('an enemy shooting the player kills them in exactly three hits', () => {
  const sim = makeSim();
  const player = sim.world.player;
  const shooter = addDummy(sim, { x: 500, y: 400 });
  makeAccurate(shooter);
  shooter.controller = {
    getIntent: () => ({
      moveX: 0,
      moveY: 0,
      aimAngle: Math.PI, // toward the player along -x
      fire: true,
      blind: null,
      reload: false,
      crouch: false,
    }),
  };

  const events = run(sim, 120);
  assert.equal(ofType(events, 'agentDamaged').filter((e) => e.agentId === player.id).length, 3);
  assert.equal(player.alive, false);
  assert.equal(ofType(events, 'agentDied').length, 1);
});
