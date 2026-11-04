import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventQueue } from '../../src/core/eventQueue.js';

test('emit then drain returns events in order and clears the queue', () => {
  const queue = new EventQueue();
  queue.emit('a', { n: 1 });
  queue.emit('b');
  assert.equal(queue.size, 2);
  assert.deepEqual(queue.drain(), [{ type: 'a', n: 1 }, { type: 'b' }]);
  assert.equal(queue.size, 0);
  assert.deepEqual(queue.drain(), []);
});

test('subscribe gets events synchronously until unsubscribed', () => {
  const queue = new EventQueue();
  const seen = [];
  const unsubscribe = queue.subscribe((event) => seen.push(event.type));
  queue.emit('a');
  unsubscribe();
  queue.emit('b');
  assert.deepEqual(seen, ['a']);
});

test('the oldest events are dropped beyond the limit', () => {
  const queue = new EventQueue({ limit: 3 });
  for (let i = 0; i < 5; i++) queue.emit('e', { i });
  assert.deepEqual(queue.drain().map((event) => event.i), [2, 3, 4]);
});
