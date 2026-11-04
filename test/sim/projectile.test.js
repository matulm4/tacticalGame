import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS } from '../../src/sim/defs/weapons.js';
import { addDummy, makeAccurate, makeSim, ofType, rect, run } from '../../test-support/sim.js';

// Player at (100, 400) aims along +x. A dummy stands at (500, 400).
const wall = (height) => [rect('wall', 250, 300, 20, 200, height)];
const fireOnce = (i) => ({ fire: i === 0 });

function shootDummy({ obstacles = [], playerCrouched = false, dummy = {}, ticks = 90 } = {}) {
  const sim = makeSim({ obstacles });
  makeAccurate(sim.world.player);
  const target = addDummy(sim, { x: 500, y: 400, ...dummy });
  const events = run(sim, ticks, (i) => ({ fire: i < 3, crouch: playerCrouched }));
  return { sim, target, events };
}

test('bullets travel at the weapon speed', () => {
  const sim = makeSim();
  run(sim, 1, { fire: true });
  run(sim, 30);
  const [bullet] = sim.world.bullets;
  // starts at the muzzle, then 31 ticks at 900 units/s
  assert.ok(Math.abs(bullet.x - (100 + WEAPONS.rifle.muzzleLength + (900 * 31) / 60)) < 1, `x ${bullet.x}`);
});

test('a bullet kills an enemy dummy with one hit', () => {
  const { target, events } = shootDummy();
  assert.equal(target.alive, false);
  assert.equal(target.hp, 0);
  assert.equal(ofType(events, 'agentDied').length, 1);
  assert.ok(ofType(events, 'bulletHit').some((e) => e.kind === 'agent'));
});

test('high cover stops bullets', () => {
  const { target, events } = shootDummy({ obstacles: wall('high') });
  assert.equal(target.alive, true);
  const hit = ofType(events, 'bulletHit')[0];
  assert.equal(hit.kind, 'wall');
  assert.equal(hit.obstacleId, 'wall');
});

test('a standing shooter shoots over low cover', () => {
  const { target } = shootDummy({ obstacles: wall('low') });
  assert.equal(target.alive, false);
});

test('a crouched shooter cannot shoot over low cover', () => {
  const { target, events } = shootDummy({ obstacles: wall('low'), playerCrouched: true });
  assert.equal(target.alive, true);
  assert.ok(ofType(events, 'bulletHit').every((e) => e.kind === 'wall'));
});

test('blind fire from a crouched shooter passes over low cover', () => {
  const sim = makeSim({ obstacles: wall('low') });
  makeAccurate(sim.world.player);
  const target = addDummy(sim, { x: 500, y: 400 });
  sim.world.player.controller = {
    getIntent: () => ({ moveX: 0, moveY: 0, aimAngle: 0, fire: true, blind: { x: 0, y: 0 }, reload: false, crouch: true }),
  };
  run(sim, 60);
  assert.equal(sim.world.player.crouched, true);
  assert.equal(target.alive, false);
});

test('blind fire is still stopped by high cover', () => {
  const sim = makeSim({ obstacles: wall('high') });
  makeAccurate(sim.world.player);
  const target = addDummy(sim, { x: 500, y: 400 });
  sim.world.player.controller = {
    getIntent: () => ({ moveX: 0, moveY: 0, aimAngle: 0, fire: true, blind: { x: 0, y: 0 }, reload: false, crouch: true }),
  };
  run(sim, 60);
  assert.equal(target.alive, true);
});

test('a crouched target behind low cover is protected', () => {
  const { target, events } = shootDummy({ obstacles: wall('low'), dummy: { crouched: true } });
  assert.equal(target.alive, true);
  assert.ok(ofType(events, 'bulletHit').some((e) => e.kind === 'wall' && e.obstacleId === 'wall'));
});

test('a crouched target in the open can still be hit', () => {
  const { target } = shootDummy({ dummy: { crouched: true } });
  assert.equal(target.alive, false);
});

test('crouching shrinks the hit area', () => {
  // Bullets fly along y = 400; targets sit 12 units off the line.
  const standing = shootDummy({ dummy: { crouched: false } });
  assert.equal(standing.target.alive, false);

  const sim = makeSim();
  makeAccurate(sim.world.player);
  const offLine = (crouched) => addDummy(sim, { x: 500, y: 412, crouched });
  const standingOff = offLine(false);
  run(sim, 90, (i) => ({ fire: i < 3 }));
  assert.equal(standingOff.alive, false, 'standing radius 14 covers a 12-unit offset');

  const sim2 = makeSim();
  makeAccurate(sim2.world.player);
  const crouchedOff = addDummy(sim2, { x: 500, y: 412, crouched: true });
  run(sim2, 90, (i) => ({ fire: i < 3 }));
  assert.equal(crouchedOff.alive, true, 'crouched radius 9.8 does not');
});

test('bullets pass through friendly agents and hit the enemy behind', () => {
  const sim = makeSim();
  makeAccurate(sim.world.player);
  const friend = addDummy(sim, { x: 300, y: 400, team: 'player' });
  const enemy = addDummy(sim, { x: 600, y: 400 });
  run(sim, 90, (i) => ({ fire: i < 3 }));
  assert.equal(friend.alive, true);
  assert.equal(enemy.alive, false);
});

test('bullets stop at the arena edge', () => {
  const sim = makeSim();
  const events = run(sim, 90, fireOnce);
  assert.ok(ofType(events, 'bulletHit').some((e) => e.kind === 'bounds'));
  assert.equal(sim.world.bullets.length, 0);
});

test('bullets expire at the end of their range', () => {
  const sim = makeSim({ width: 3000 });
  const events = run(sim, 100, fireOnce);
  assert.equal(sim.world.bullets.length, 0);
  assert.equal(ofType(events, 'bulletHit').length, 0);
});
