import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_TYPES } from '../../src/sim/defs/agentTypes.js';
import { makeSim, ofType, rect, run } from '../../test-support/sim.js';

const weaponOf = (sim) => sim.world.player.weapons[0];
const angleOf = (bullet) => (Math.atan2(bullet.vy, bullet.vx) * 180) / Math.PI;

test('the rifle fires about ten rounds a second', () => {
  const sim = makeSim();
  const shots = ofType(run(sim, 60, { fire: true }), 'shotFired').length;
  assert.ok(shots >= 10 && shots <= 11, `shots ${shots}`);
});

test('a full magazine is 30 rounds; an empty trigger pull starts a reload', () => {
  const sim = makeSim({ width: 8000 });
  const events = run(sim, 200, { fire: true });
  assert.equal(ofType(events, 'shotFired').length, 30);
  assert.equal(ofType(events, 'reloadStarted').length, 1);
  assert.ok(weaponOf(sim).reloadLeft > 0);
});

test('R reloads a partly used magazine in 1.8 seconds', () => {
  const sim = makeSim();
  weaponOf(sim).ammo = 10;

  assert.equal(ofType(run(sim, 1, { reload: true }), 'reloadStarted').length, 1);
  run(sim, 100);
  assert.equal(weaponOf(sim).ammo, 10, 'still reloading after ~1.7 s');

  const events = run(sim, 15);
  assert.equal(ofType(events, 'reloadFinished').length, 1);
  assert.equal(weaponOf(sim).ammo, 30);
});

test('reloading a full magazine does nothing', () => {
  const sim = makeSim();
  assert.equal(ofType(run(sim, 1, { reload: true }), 'reloadStarted').length, 0);
});

test('the rifle cannot fire while reloading', () => {
  const sim = makeSim();
  weaponOf(sim).ammo = 10;
  run(sim, 1, { reload: true });
  assert.equal(ofType(run(sim, 50, { fire: true }), 'shotFired').length, 0);
});

test('ammo is infinite: every reload refills the magazine', () => {
  const sim = makeSim();
  for (let i = 0; i < 3; i++) {
    weaponOf(sim).ammo = 0;
    run(sim, 1, { reload: true });
    run(sim, 115);
    assert.equal(weaponOf(sim).ammo, 30);
  }
});

test('a semi-automatic weapon needs a new trigger pull per shot', () => {
  const sim = makeSim();
  const weapon = weaponOf(sim);
  weapon.def = { ...weapon.def, auto: false };

  assert.equal(ofType(run(sim, 30, { fire: true }), 'shotFired').length, 1);
  run(sim, 1, { fire: false });
  assert.equal(ofType(run(sim, 1, { fire: true }), 'shotFired').length, 1);
});

test('standing still, spread stays within the base cone', () => {
  const sim = makeSim({ width: 8000 });
  for (let i = 0; i < 300; i++) {
    weaponOf(sim).cooldown = 0;
    weaponOf(sim).ammo = 30;
    run(sim, 1, { fire: true });
  }
  const angles = sim.world.bullets.map(angleOf);
  assert.ok(angles.length > 30);
  assert.ok(angles.every((a) => Math.abs(a) <= 2 + 1e-6));
  assert.ok(new Set(angles.map((a) => a.toFixed(4))).size > 10, 'spread is actually random');
});

test('walking widens the spread', () => {
  const sim = makeSim({ width: 8000 });
  for (let i = 0; i < 100; i++) {
    weaponOf(sim).cooldown = 0;
    weaponOf(sim).ammo = 30;
    run(sim, 1, { fire: true, moveX: 1 });
  }
  const angles = sim.world.bullets.map(angleOf);
  assert.ok(angles.every((a) => Math.abs(a) <= 5 + 1e-6));
  assert.ok(angles.some((a) => Math.abs(a) > 2), 'some shots exceed the standing cone');
});

test('a wall at the muzzle swallows the shot', () => {
  // Just clear of the body (radius 18), but inside the muzzle point (28 ahead of the center).
  const sim = makeSim({ obstacles: [rect('wall', 100 + AGENT_TYPES.player.radius + 2, 300, 20, 200)] });
  const events = run(sim, 1, { fire: true });
  assert.equal(sim.world.bullets.length, 0);
  assert.equal(weaponOf(sim).ammo, 29);
  const hits = ofType(events, 'bulletHit');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].kind, 'wall');
});

// Blind fire reaches round a corner: the hand goes out by the blind offset, and only the
// hand-to-muzzle part of the shot has to be clear of walls.
test('blind fire with an arm reaching past the end of a high wall gets the shot out', () => {
  // A wall just in front of the player, from y 300 to 500. Aiming straight at it, a shot is swallowed...
  const walled = { obstacles: [rect('wall', 135, 300, 20, 200)] };
  const sim = makeSim(walled);
  const intentFor = (blind) => ({ moveX: 0, moveY: 0, aimAngle: 0, fire: true, blind, reload: false, crouch: false });

  sim.world.player.controller = { getIntent: () => intentFor(null) };
  run(sim, 1);
  assert.equal(sim.world.bullets.length, 0, 'a normal shot into the wall goes nowhere');

  // ...but with the arm stuck out 120 units up, past the wall's end, the bullet flies.
  const reaching = makeSim(walled);
  reaching.world.player.controller = { getIntent: () => intentFor({ x: 0, y: -120 }) };
  run(reaching, 1);
  assert.equal(reaching.world.bullets.length, 1);
  assert.equal(reaching.world.bullets[0].blind, true);
  assert.ok(reaching.world.bullets[0].y < 300, `the bullet starts above the wall (y = ${reaching.world.bullets[0].y})`);
});

test('gunshots make noise', () => {
  const sim = makeSim();
  const sounds = ofType(run(sim, 1, { fire: true }), 'soundEmitted');
  assert.equal(sounds.length, 1);
  assert.equal(sounds[0].kind, 'gunshot');
  assert.equal(sounds[0].radius, 600);
});
