import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PriorityQueue } from '../../src/core/priorityQueue.js';

test('pops items from the smallest priority up', () => {
  const queue = new PriorityQueue();
  queue.push('c', 3);
  queue.push('a', 1);
  queue.push('d', 4);
  queue.push('b', 2);

  assert.equal(queue.size, 4);
  assert.deepEqual([queue.pop(), queue.pop(), queue.pop(), queue.pop()], ['a', 'b', 'c', 'd']);
  assert.equal(queue.size, 0);
});

test('an empty queue pops undefined', () => {
  assert.equal(new PriorityQueue().pop(), undefined);
});

test('equal priorities come out in the order they went in', () => {
  const queue = new PriorityQueue();
  for (const name of ['first', 'second', 'third', 'fourth']) queue.push(name, 5);
  assert.deepEqual([queue.pop(), queue.pop(), queue.pop(), queue.pop()], ['first', 'second', 'third', 'fourth']);
});

test('stays correct when pushes and pops are mixed', () => {
  const queue = new PriorityQueue();
  const out = [];
  queue.push('x', 5);
  queue.push('y', 2);
  out.push(queue.pop()); // y
  queue.push('z', 1);
  queue.push('w', 9);
  out.push(queue.pop(), queue.pop(), queue.pop()); // z, x, w
  assert.deepEqual(out, ['y', 'z', 'x', 'w']);
});

test('sorts a large shuffled input', () => {
  const queue = new PriorityQueue();
  const values = Array.from({ length: 500 }, (_, i) => (i * 7919) % 503);
  for (const value of values) queue.push(value, value);
  const popped = [];
  while (queue.size > 0) popped.push(queue.pop());
  assert.deepEqual(popped, [...values].sort((a, b) => a - b));
});
