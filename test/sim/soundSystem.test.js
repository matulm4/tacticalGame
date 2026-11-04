import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soundSystem } from '../../src/sim/systems/soundSystem.js';
import { addDummy, makeSim, rect, run } from '../../test-support/sim.js';

// The player (team 'player') makes noise at (100, 400). Listeners are enemy dummies with hearing.
const HEARING = { hearing: { sensitivity: 1 } };

function setup({ obstacles = [], listenerAt = [220, 400], listenerDef = HEARING } = {}) {
  const sim = makeSim({ obstacles });
  const listener = addDummy(sim, { x: listenerAt[0], y: listenerAt[1], def: listenerDef });
  return { sim, world: sim.world, listener };
}

const noise = (radius = 200, overrides = {}) => ({
  kind: 'gunshot',
  x: 100,
  y: 400,
  radius,
  sourceId: 1,
  team: 'player',
  ...overrides,
});

function hear(world, sound) {
  world.emitSound(sound);
  soundSystem(world);
}

test('a listener inside the radius hears the sound, with how loud it was', () => {
  const { world, listener } = setup(); // 120 away
  hear(world, noise(200));

  assert.equal(listener.heardSounds.length, 1);
  const [heard] = listener.heardSounds;
  assert.equal(heard.kind, 'gunshot');
  assert.deepEqual([heard.x, heard.y, heard.sourceId], [100, 400, 1]);
  assert.ok(Math.abs(heard.distance - 120) < 1e-9);
  assert.ok(Math.abs(heard.loudness - 0.4) < 1e-9); // 1 - 120 / 200
});

test('a listener outside the radius hears nothing', () => {
  const { world, listener } = setup({ listenerAt: [320, 400] }); // 220 away
  hear(world, noise(200));
  assert.equal(listener.heardSounds.length, 0);
});

test('walls muffle a sound: a high wall halves how far it carries, a low one trims it', () => {
  // Radius 200, listener 120 away. With a high wall the reach is 100: not heard.
  const high = setup({ obstacles: [rect('wall', 150, 300, 20, 200, 'high')] });
  hear(high.world, noise(200));
  assert.equal(high.listener.heardSounds.length, 0);

  // With a low wall the reach is 170: still heard at 120, but not at 180.
  const lowNear = setup({ obstacles: [rect('wall', 150, 300, 20, 200, 'low')] });
  hear(lowNear.world, noise(200));
  assert.equal(lowNear.listener.heardSounds.length, 1);

  const lowFar = setup({ obstacles: [rect('wall', 150, 300, 20, 200, 'low')], listenerAt: [280, 400] });
  hear(lowFar.world, noise(200));
  assert.equal(lowFar.listener.heardSounds.length, 0);
});

test('every wall in the way muffles it again', () => {
  const walls = [rect('a', 140, 300, 10, 200, 'high'), rect('b', 170, 300, 10, 200, 'high')];
  const near = setup({ obstacles: walls, listenerAt: [190, 400] }); // 90 away; reach 200 * 0.25 = 50
  hear(near.world, noise(200));
  assert.equal(near.listener.heardSounds.length, 0);

  const oneWall = setup({ obstacles: [walls[0]], listenerAt: [190, 400] }); // reach 100
  hear(oneWall.world, noise(200));
  assert.equal(oneWall.listener.heardSounds.length, 1);
});

test('agents ignore sounds from their own side', () => {
  const { world, listener } = setup();
  hear(world, noise(200, { team: 'enemy' }));
  assert.equal(listener.heardSounds.length, 0);
});

test('dead agents and agents without hearing hear nothing', () => {
  const { world, listener } = setup();
  listener.alive = false;
  hear(world, noise(200));
  assert.equal(listener.heardSounds.length, 0);

  const deaf = setup({ listenerDef: {} });
  hear(deaf.world, noise(200));
  assert.equal(deaf.listener.heardSounds.length, 0);
});

test('hearing sensitivity scales the reach', () => {
  const keen = setup({ listenerAt: [320, 400], listenerDef: { hearing: { sensitivity: 2 } } }); // 220 away
  hear(keen.world, noise(200)); // reach 400
  assert.equal(keen.listener.heardSounds.length, 1);

  const dull = setup({ listenerDef: { hearing: { sensitivity: 0.5 } } }); // 120 away
  hear(dull.world, noise(200)); // reach 100
  assert.equal(dull.listener.heardSounds.length, 0);
});

test('the inbox is replaced every tick and the world forgets delivered sounds', () => {
  const { world, listener } = setup();
  hear(world, noise(200));
  assert.equal(listener.heardSounds.length, 1);
  assert.equal(world.sounds.length, 0);

  soundSystem(world); // a quiet tick
  assert.equal(listener.heardSounds.length, 0);
});

test('every sound is also an event for the renderer', () => {
  const { world } = setup();
  const before = world.events.size;
  world.emitSound(noise(200));
  assert.equal(world.events.size, before + 1);
});

test('crouch-walking is quieter than walking: a nearby listener hears one but not the other', () => {
  const heardWhile = (crouch) => {
    // The listener sits 100 units to the side of the player's path.
    const { sim, listener } = setup({ listenerAt: [100, 500] });
    let heard = false;
    for (let tick = 0; tick < 100; tick++) {
      run(sim, 1, { moveX: 1, crouch });
      if (listener.heardSounds.length > 0) heard = true;
    }
    return heard;
  };

  assert.equal(heardWhile(false), true, 'walking footsteps carry 140');
  assert.equal(heardWhile(true), false, 'crouched footsteps carry only 60');
});
