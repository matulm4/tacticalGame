import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DebugFlags } from '../../src/client/DebugFlags.js';

test('overlays start off and can be switched on and toggled', () => {
  const flags = new DebugFlags();
  assert.deepEqual([flags.vision, flags.noise, flags.plan, flags.cover], [false, false, false, false]);
  assert.deepEqual([...DebugFlags.NAMES], ['vision', 'noise', 'plan', 'cover', 'squads']);

  flags.set('vision', true);
  assert.equal(flags.vision, true);
  flags.toggle('vision');
  assert.equal(flags.vision, false);
  flags.toggle('noise');
  assert.equal(flags.noise, true);
});

test('listeners hear every change until they unsubscribe', () => {
  const flags = new DebugFlags();
  const seen = [];
  const unsubscribe = flags.subscribe((f) => seen.push(f.vision));

  flags.toggle('vision');
  flags.toggle('vision');
  unsubscribe();
  flags.toggle('vision');
  assert.deepEqual(seen, [true, false]);
});

test('unknown flags are rejected', () => {
  assert.throws(() => new DebugFlags().set('wallhack', true), /Unknown debug flag/);
});
