import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AddObstacle } from '../../src/editor/commands/index.js';
import { GRID_SIZES } from '../../src/editor/limits.js';
import { at, click, drag, makeEditor, obstacle } from '../../test-support/editor.js';
import { makeMap, rect, spawn } from '../../test-support/sim.js';

test('starts with the select tool, snapping on, and nothing to undo', () => {
  const editor = makeEditor();
  assert.equal(editor.toolId, 'select');
  assert.equal(editor.snap.enabled, true);
  assert.equal(editor.canUndo, false);
  assert.equal(editor.dirty, false);
  assert.equal(editor.selection, null);
});

test('loadMap works on a copy and resets history, selection and the unsaved flag', () => {
  const source = makeMap({ obstacles: [rect('a', 100, 100, 50, 50)] });
  const editor = makeEditor();
  editor.setTool('rect');
  drag(editor, at(200, 200), at(300, 300));
  assert.equal(editor.dirty, true);

  editor.loadMap(source);
  assert.equal(editor.canUndo, false);
  assert.equal(editor.dirty, false);
  assert.equal(editor.selection, null);

  editor.map.obstacles[0].x = 999;
  assert.equal(source.obstacles[0].x, 100, 'the source map is untouched');
});

test('newMap gives an empty map with no player start', () => {
  const editor = makeEditor();
  editor.newMap();
  assert.deepEqual([editor.map.obstacles.length, editor.map.spawns.length, editor.map.playerStart], [0, 0, null]);
});

test('observers hear about every change, and can unsubscribe', () => {
  const editor = makeEditor();
  let calls = 0;
  const unsubscribe = editor.subscribe(() => calls++);

  editor.execute(new AddObstacle(rect('a', 1, 1, 20, 20)));
  assert.ok(calls > 0);

  unsubscribe();
  const before = calls;
  editor.undo();
  assert.equal(calls, before);
});

test('undoing the creation of the selected item clears the selection', () => {
  const editor = makeEditor();
  editor.setTool('rect');
  drag(editor, at(100, 100), at(200, 200));
  assert.ok(editor.selection);
  editor.undo();
  assert.equal(editor.selection, null);
  editor.redo();
  assert.equal(editor.map.obstacles.length, 1);
});

test('nextId skips ids that are taken', () => {
  const editor = makeEditor({
    obstacles: [rect('o1', 0, 0, 20, 20), rect('o3', 50, 0, 20, 20)],
    spawns: [spawn('s1', 500, 500)],
  });
  assert.equal(editor.nextId('o'), 'o2');
  assert.equal(editor.nextId('s'), 's2');
});

test('unknown tools, grid sizes, heights and enemy types are rejected', () => {
  const editor = makeEditor();
  assert.throws(() => editor.setTool('lasso'), /Unknown tool/);
  assert.throws(() => editor.setGridSize(7), /grid size/);
  assert.throws(() => editor.setCoverHeight('medium'), /cover height/);
  assert.throws(() => editor.setSpawnType('player'), /enemy type/);
  assert.ok(GRID_SIZES.every((size) => editor.setGridSize(size) === undefined));
});

test('only enemy archetypes are offered for spawning', () => {
  const editor = makeEditor();
  assert.ok(editor.spawnTypes.includes('grunt'));
  assert.ok(editor.spawnTypes.includes('sentry'));
  assert.ok(!editor.spawnTypes.includes('player'));
});

test('snapping rounds to the grid; Alt or switching it off disables it', () => {
  const editor = makeEditor();
  assert.deepEqual(editor.snapPoint(at(113, 127)), { x: 120, y: 120 });
  assert.deepEqual(editor.snapPoint(at(113, 127), { alt: true }), { x: 113, y: 127 });

  editor.toggleSnap();
  assert.deepEqual(editor.snapPoint(at(113, 127)), { x: 113, y: 127 });

  editor.toggleSnap();
  editor.setGridSize(50);
  assert.deepEqual(editor.snapPoint(at(113, 127)), { x: 100, y: 150 });
});

test('changing the cover height also changes the selected obstacle, undoably', () => {
  const editor = makeEditor({ obstacles: [rect('a', 100, 100, 100, 100)] });
  click(editor, at(150, 150));
  assert.equal(editor.activeCoverHeight(), 'high');

  editor.setCoverHeight('low');
  assert.equal(obstacle(editor, 'a').height, 'low');
  assert.equal(editor.coverHeight, 'low', 'and becomes the default for new obstacles');

  editor.undo();
  assert.equal(obstacle(editor, 'a').height, 'high');

  editor.toggleCoverHeight();
  assert.equal(obstacle(editor, 'a').height, 'low');
  editor.toggleCoverHeight();
  assert.equal(obstacle(editor, 'a').height, 'high');
});

test('with nothing selected, the cover height only sets the default for new obstacles', () => {
  const editor = makeEditor({ obstacles: [rect('a', 100, 100, 100, 100)] });
  editor.toggleCoverHeight();
  assert.equal(editor.coverHeight, 'low');
  assert.equal(obstacle(editor, 'a').height, 'high');
  assert.equal(editor.canUndo, false);
});

test('Escape cancels, then deselects, then returns to the select tool', () => {
  const editor = makeEditor();
  editor.setTool('rect');
  editor.pointerDown(at(100, 100));
  editor.pointerMove(at(200, 200));
  assert.ok(editor.tool.preview());

  editor.escape(); // cancels the drag
  assert.equal(editor.tool.preview(), null);
  assert.equal(editor.map.obstacles.length, 0);
  assert.equal(editor.toolId, 'rect');

  drag(editor, at(100, 100), at(200, 200));
  editor.escape(); // deselects
  assert.equal(editor.selection, null);
  assert.equal(editor.toolId, 'rect');

  editor.escape(); // back to select
  assert.equal(editor.toolId, 'select');
});

test('switching tools abandons a drag in progress', () => {
  const editor = makeEditor();
  editor.setTool('rect');
  editor.pointerDown(at(100, 100));
  editor.setTool('circle');
  editor.setTool('rect');
  assert.equal(editor.tool.preview(), null);
});

test('clearMap is undoable', () => {
  const editor = makeEditor({ obstacles: [rect('a', 100, 100, 50, 50)], spawns: [spawn('s1', 500, 500)] });
  editor.clearMap();
  assert.deepEqual([editor.map.obstacles.length, editor.map.spawns.length, editor.map.playerStart], [0, 0, null]);
  editor.undo();
  assert.deepEqual([editor.map.obstacles.length, editor.map.spawns.length], [1, 1]);
  assert.ok(editor.map.playerStart);
});

test('messages are shown until the next change; markSaved clears the unsaved flag', () => {
  const editor = makeEditor();
  editor.setMessage('Something happened', 'error');
  assert.deepEqual(editor.message, { text: 'Something happened', severity: 'error' });

  editor.execute(new AddObstacle(rect('a', 1, 1, 20, 20)));
  assert.equal(editor.message, null);
  assert.equal(editor.dirty, true);

  editor.markSaved();
  assert.equal(editor.dirty, false);
});

test('renaming the map marks it changed', () => {
  const editor = makeEditor();
  editor.setName('Warehouse');
  assert.equal(editor.map.name, 'Warehouse');
  assert.equal(editor.dirty, true);
});
