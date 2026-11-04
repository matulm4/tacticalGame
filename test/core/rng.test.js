import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../../src/core/rng.js';

const take = (rng, count) => Array.from({ length: count }, () => rng.next());

test('same seed gives the same stream, different seeds differ', () => {
  assert.deepEqual(take(new Rng(42), 20), take(new Rng(42), 20));
  assert.notDeepEqual(take(new Rng(42), 20), take(new Rng(43), 20));
});

test('next() stays in [0, 1) and is roughly uniform', () => {
  const values = take(new Rng(7), 10000);
  assert.ok(values.every((v) => v >= 0 && v < 1));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  assert.ok(Math.abs(mean - 0.5) < 0.02, `mean ${mean}`);
});

test('range, int and pick respect their bounds', () => {
  const rng = new Rng(3);
  for (let i = 0; i < 1000; i++) {
    const r = rng.range(-2, 5);
    assert.ok(r >= -2 && r < 5);
    const n = rng.int(10, 15);
    assert.ok(Number.isInteger(n) && n >= 10 && n < 15);
  }
  assert.ok(['a', 'b', 'c'].includes(rng.pick(['a', 'b', 'c'])));
});

test('state can resume the stream', () => {
  const a = new Rng(5);
  a.next();
  const b = new Rng(a.state);
  assert.deepEqual(take(a, 10), take(b, 10));
});

test('fork is deterministic and labels give independent streams', () => {
  const first = new Rng(9).fork('ai');
  const second = new Rng(9).fork('ai');
  assert.deepEqual(take(first, 10), take(second, 10));
  assert.notDeepEqual(take(new Rng(9).fork('ai'), 10), take(new Rng(9).fork('audio'), 10));
});
