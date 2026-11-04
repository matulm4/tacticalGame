import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BurstFire } from '../../src/sim/ai/actions/burst.js';

const DT = 1 / 60;
const weapon = (ammo) => ({ ammo });

test('it is clear to fire until a burst has gone off, then it rests', () => {
  const burst = new BurstFire({ shots: 3, pause: 0.5 });
  const gun = weapon(30);
  burst.reset(gun);

  assert.equal(burst.update(gun, DT), true);
  gun.ammo -= 1;
  assert.equal(burst.update(gun, DT), true);
  gun.ammo -= 1;
  assert.equal(burst.update(gun, DT), true);
  gun.ammo -= 1; // the third shot of the burst

  assert.equal(burst.update(gun, DT), false);
  assert.equal(burst.resting, true);
});

test('after the pause it fires again', () => {
  const burst = new BurstFire({ shots: 1, pause: 0.2 });
  const gun = weapon(30);
  burst.reset(gun);
  burst.update(gun, DT);
  gun.ammo -= 1;
  assert.equal(burst.update(gun, DT), false);

  let ticks = 0;
  while (!burst.update(gun, DT) && ticks < 100) ticks++;
  assert.ok(ticks >= 10 && ticks <= 14, `rested ${ticks} ticks`); // 0.2 s at 60 Hz
  assert.equal(burst.resting, false);
});

test('shots fired between two updates are all counted', () => {
  const burst = new BurstFire({ shots: 3, pause: 0.5 });
  const gun = weapon(30);
  burst.reset(gun);
  gun.ammo -= 3;
  assert.equal(burst.update(gun, DT), false);
});

test('reloading (ammo going up) does not count as shots', () => {
  const burst = new BurstFire({ shots: 3, pause: 0.5 });
  const gun = weapon(2);
  burst.reset(gun);
  gun.ammo = 30;
  assert.equal(burst.update(gun, DT), true);
  assert.equal(burst.resting, false);
});

test('reset forgets a burst in progress', () => {
  const burst = new BurstFire({ shots: 3, pause: 0.5 });
  const gun = weapon(30);
  burst.reset(gun);
  gun.ammo -= 3;
  burst.update(gun, DT);
  assert.equal(burst.resting, true);
  burst.reset(gun);
  assert.equal(burst.resting, false);
});
