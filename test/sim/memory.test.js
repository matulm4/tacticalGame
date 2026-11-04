import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkingMemory } from '../../src/sim/ai/memory/WorkingMemory.js';
import { hearSounds } from '../../src/sim/ai/perception/HearingSensor.js';
import { Perception } from '../../src/sim/ai/perception/Perception.js';
import { makeSim, spawn } from '../../test-support/sim.js';

const target = (id, x, y) => ({ id, x, y });

test('seeing a target records it, and when it was first seen without a break', () => {
  const memory = new WorkingMemory();
  memory.see(target(1, 10, 20), 5);
  memory.see(target(1, 12, 22), 5.5);

  assert.deepEqual(memory.target, { id: 1, x: 12, y: 22 });
  assert.equal(memory.visibleSince, 5, 'unbroken sight keeps the first time');
  assert.deepEqual(memory.lastKnown, { id: 1, x: 12, y: 22, time: 5.5 });
});

test('losing sight clears the target but remembers where it was last seen', () => {
  const memory = new WorkingMemory();
  memory.see(target(1, 10, 20), 5);
  memory.loseSight();

  assert.equal(memory.target, null);
  assert.equal(memory.visibleSince, null);
  assert.deepEqual(memory.lastKnown, { id: 1, x: 10, y: 20, time: 5 });

  memory.see(target(1, 30, 30), 8);
  assert.equal(memory.visibleSince, 8, 'sight that was broken starts a new timer');
});

test('switching to another target restarts the timer', () => {
  const memory = new WorkingMemory();
  memory.see(target(1, 0, 0), 1);
  memory.see(target(2, 5, 5), 3);
  assert.equal(memory.visibleSince, 3);
});

test('there is nothing to investigate until something is seen or heard', () => {
  assert.equal(new WorkingMemory().investigationPoint(5), null);
});

test('the newest unchecked thing is worth investigating, and it says which kind', () => {
  const memory = new WorkingMemory();
  memory.see(target(1, 10, 20), 2);
  memory.loseSight();
  assert.deepEqual(memory.investigationPoint(3), { x: 10, y: 20, time: 2, reason: 'lostSight' });

  memory.hear({ kind: 'footstep', x: 90, y: 80, distance: 50 }, 4);
  assert.deepEqual(memory.investigationPoint(5), { x: 90, y: 80, time: 4, reason: 'noise' });
});

test('things that are too old are forgotten (a noise after 8 s, a sighting after 10 s)', () => {
  const memory = new WorkingMemory();
  memory.hear({ kind: 'gunshot', x: 1, y: 1, distance: 100 }, 1);
  assert.ok(memory.investigationPoint(9));
  assert.equal(memory.investigationPoint(9.5), null);

  memory.see(target(1, 5, 5), 1);
  memory.loseSight();
  assert.ok(memory.investigationPoint(10.5));
  assert.equal(memory.investigationPoint(11.5), null);
});

test('once checked out, it is not investigated again; newer things still are', () => {
  const memory = new WorkingMemory();
  memory.hear({ kind: 'gunshot', x: 1, y: 1, distance: 100 }, 1);
  memory.markInvestigated(2);
  assert.equal(memory.investigationPoint(3), null);

  memory.hear({ kind: 'gunshot', x: 7, y: 7, distance: 100 }, 4);
  assert.equal(memory.investigationPoint(5).x, 7);
});

test('a heard noise is remembered with an uncertainty that grows with distance', () => {
  const memory = new WorkingMemory();
  memory.hear({ kind: 'gunshot', x: 50, y: 60, distance: 300 }, 2);
  assert.deepEqual(memory.noise, { kind: 'gunshot', x: 50, y: 60, time: 2, uncertainty: 60 });
});

test('of several sounds in one tick, the loudest is remembered', () => {
  const memory = new WorkingMemory();
  hearSounds(
    memory,
    [
      { kind: 'footstep', x: 1, y: 1, distance: 100, loudness: 0.2 },
      { kind: 'gunshot', x: 2, y: 2, distance: 50, loudness: 0.9 },
      { kind: 'footstep', x: 3, y: 3, distance: 90, loudness: 0.4 },
    ],
    1,
  );
  assert.equal(memory.noise.kind, 'gunshot');

  const quiet = new WorkingMemory();
  hearSounds(quiet, [], 1);
  assert.equal(quiet.noise, null);
});

test('perception looks right away, then only a few times a second, but hears every tick', () => {
  const sim = makeSim({ spawns: [spawn('e', 400, 400, { angle: Math.PI })] });
  const { world } = sim;
  const [player, enemy] = world.agents;
  player.x = 100;
  player.y = 400;
  const perception = new Perception();
  const dt = 1 / 60;

  perception.update(enemy, world, dt);
  assert.equal(perception.memory.target?.id, player.id, 'the first update looks');

  player.x = 700; // directly behind the enemy: outside its cone
  perception.update(enemy, world, dt);
  perception.update(enemy, world, dt);
  assert.equal(perception.memory.target?.id, player.id, 'not looked again yet');

  for (let i = 0; i < 6; i++) perception.update(enemy, world, dt);
  assert.equal(perception.memory.target, null, 'a later look lost sight');
  assert.equal(perception.memory.lastKnown.id, player.id);

  enemy.heardSounds = [{ kind: 'gunshot', x: 9, y: 9, distance: 100, loudness: 0.5, sourceId: 1 }];
  perception.update(enemy, world, dt);
  assert.equal(perception.memory.noise.x, 9, 'hearing is taken in on every tick');
});
