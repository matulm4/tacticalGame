import { test } from 'node:test';
import assert from 'node:assert/strict';
import { History } from '../../src/editor/History.js';
import { HISTORY_LIMIT } from '../../src/editor/limits.js';

// A command that appends `name` to map.log and removes it again on undo.
const command = (name) => ({
  do: (map) => map.log.push(name),
  undo: (map) => map.log.pop(),
});

test('execute runs the command; undo and redo step through them', () => {
  const history = new History();
  const map = { log: [] };

  history.execute(command('a'), map);
  history.execute(command('b'), map);
  assert.deepEqual(map.log, ['a', 'b']);

  history.undo(map);
  assert.deepEqual(map.log, ['a']);
  history.undo(map);
  assert.deepEqual(map.log, []);
  assert.equal(history.undo(map), null);

  history.redo(map);
  history.redo(map);
  assert.deepEqual(map.log, ['a', 'b']);
  assert.equal(history.redo(map), null);
});

test('a new command clears the redo stack', () => {
  const history = new History();
  const map = { log: [] };
  history.execute(command('a'), map);
  history.undo(map);
  assert.equal(history.canRedo, true);

  history.execute(command('b'), map);
  assert.equal(history.canRedo, false);
  assert.deepEqual(map.log, ['b']);
});

test('record stores an already-applied command without running it again', () => {
  const history = new History();
  const map = { log: ['a'] }; // 'a' was applied live by a drag
  history.record(command('a'));
  assert.deepEqual(map.log, ['a']);

  history.undo(map);
  assert.deepEqual(map.log, []);
});

test('canUndo / canRedo / clear', () => {
  const history = new History();
  const map = { log: [] };
  assert.equal(history.canUndo, false);

  history.execute(command('a'), map);
  assert.equal(history.canUndo, true);
  history.undo(map);
  assert.equal(history.canRedo, true);

  history.clear();
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
});

test('only the most recent HISTORY_LIMIT steps are kept', () => {
  const history = new History();
  const map = { log: [] };
  for (let i = 0; i < HISTORY_LIMIT + 10; i++) history.execute(command(i), map);

  let undone = 0;
  while (history.undo(map)) undone++;
  assert.equal(undone, HISTORY_LIMIT);
});
