import { test } from 'node:test';
import assert from 'node:assert/strict';
import { at, click, drag, makeEditor, obstacle, spawnOf } from '../../test-support/editor.js';
import { circle, rect, spawn } from '../../test-support/sim.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ---- Rectangle tool -----------------------------------------------------------

test('rectangle: dragging draws a snapped obstacle, selects it, and undo removes it', () => {
  const editor = makeEditor();
  editor.setTool('rect');
  drag(editor, at(105, 105), at(255, 205));

  assert.deepEqual(editor.map.obstacles, [
    { id: 'o1', shape: 'rect', x: 100, y: 100, w: 160, h: 100, height: 'high' },
  ]);
  assert.deepEqual(editor.selection, { kind: 'obstacle', id: 'o1' });
  assert.equal(editor.dirty, true);

  editor.undo();
  assert.deepEqual(editor.map.obstacles, []);
  assert.equal(editor.selection, null);
});

test('rectangle: dragging backwards gives the same box', () => {
  const editor = makeEditor();
  editor.setTool('rect');
  drag(editor, at(255, 205), at(105, 105));
  assert.deepEqual(
    [obstacle(editor, 'o1').x, obstacle(editor, 'o1').y, obstacle(editor, 'o1').w, obstacle(editor, 'o1').h],
    [100, 100, 160, 100],
  );
});

test('rectangle: a tiny drag draws nothing', () => {
  const editor = makeEditor();
  editor.setTool('rect');
  drag(editor, at(100, 100), at(104, 104));
  assert.equal(editor.map.obstacles.length, 0);
  assert.equal(editor.canUndo, false);
});

test('rectangle: Alt turns snapping off, Shift makes a square', () => {
  const free = makeEditor();
  free.setTool('rect');
  drag(free, at(105, 105), at(255, 205), { alt: true });
  assert.deepEqual(
    [obstacle(free, 'o1').x, obstacle(free, 'o1').y, obstacle(free, 'o1').w, obstacle(free, 'o1').h],
    [105, 105, 150, 100],
  );

  const square = makeEditor();
  square.setTool('rect');
  drag(square, at(100, 100), at(300, 180), { shift: true });
  assert.deepEqual(
    [obstacle(square, 'o1').w, obstacle(square, 'o1').h],
    [200, 200],
  );
});

test('rectangle: stays inside the map', () => {
  const editor = makeEditor();
  editor.setTool('rect');
  drag(editor, at(900, 700), at(1200, 900));
  const o = obstacle(editor, 'o1');
  assert.deepEqual([o.x, o.y, o.w, o.h], [900, 700, 100, 100]);
});

test('rectangle: new obstacles take the chosen cover height', () => {
  const editor = makeEditor();
  editor.setCoverHeight('low');
  editor.setTool('rect');
  drag(editor, at(100, 100), at(200, 200));
  assert.equal(obstacle(editor, 'o1').height, 'low');
});

test('rectangle: shows a ghost while dragging, none otherwise', () => {
  const editor = makeEditor();
  editor.setTool('rect');
  assert.equal(editor.tool.preview(), null);
  editor.pointerDown(at(100, 100));
  editor.pointerMove(at(200, 160));
  assert.deepEqual(editor.tool.preview(), { kind: 'rect', x: 100, y: 100, w: 100, h: 60, height: 'high' });
  editor.pointerUp(at(200, 160));
  assert.equal(editor.tool.preview(), null);
});

// ---- Circle tool --------------------------------------------------------------

test('circle: dragging from the center draws a snapped circle', () => {
  const editor = makeEditor();
  editor.setTool('circle');
  drag(editor, at(203, 198), at(262, 200));
  assert.deepEqual(editor.map.obstacles, [
    { id: 'o1', shape: 'circle', cx: 200, cy: 200, r: 60, height: 'high' },
  ]);
  assert.deepEqual(editor.selection, { kind: 'obstacle', id: 'o1' });
});

test('circle: a tiny drag draws nothing; Alt skips snapping', () => {
  const editor = makeEditor();
  editor.setTool('circle');
  drag(editor, at(200, 200), at(204, 200));
  assert.equal(editor.map.obstacles.length, 0);

  drag(editor, at(203, 200), at(253, 200), { alt: true });
  const o = obstacle(editor, 'o1');
  assert.deepEqual([o.cx, o.cy, o.r], [203, 200, 50]);
});

// ---- Player start and enemy spawn tools --------------------------------------

test('player start: click places it snapped, undo restores the previous one', () => {
  const editor = makeEditor();
  editor.setTool('playerStart');
  click(editor, at(305, 205));
  assert.deepEqual(editor.map.playerStart, { x: 300, y: 200, angle: 0 });
  assert.deepEqual(editor.selection, { kind: 'playerStart', id: 'playerStart' });

  editor.undo();
  assert.deepEqual(editor.map.playerStart, { x: 100, y: 400, angle: 0 });
});

test('player start: dragging before release sets the direction', () => {
  const editor = makeEditor({ playerStart: null });
  editor.setTool('playerStart');
  drag(editor, at(300, 200), at(300, 300));
  assert.ok(near(editor.map.playerStart.angle, Math.PI / 2));
});

test('a tiny drag does not change the direction (dead zone), Shift snaps it', () => {
  const editor = makeEditor({ playerStart: null });
  editor.setTool('playerStart');
  drag(editor, at(300, 200), at(304, 203));
  assert.equal(editor.map.playerStart.angle, 0);

  drag(editor, at(300, 200), at(400, 240), { shift: true });
  assert.ok(near(editor.map.playerStart.angle, Math.PI / 12)); // 21.8 degrees snaps to 15
});

test('enemy spawn: each click adds a spawn with a fresh id and the current type', () => {
  const editor = makeEditor();
  editor.setTool('enemySpawn');
  click(editor, at(605, 205));
  click(editor, at(705, 305));

  assert.deepEqual(editor.map.spawns, [
    { id: 's1', type: 'grunt', team: 'enemy', x: 600, y: 200, angle: 0 },
    { id: 's2', type: 'grunt', team: 'enemy', x: 700, y: 300, angle: 0 },
  ]);
  assert.deepEqual(editor.selection, { kind: 'spawn', id: 's2' });

  editor.undo();
  assert.deepEqual(editor.map.spawns.map((s) => s.id), ['s1']);
});

test('enemy spawn: stays inside the map and shows a marker ghost on hover', () => {
  const editor = makeEditor();
  editor.setTool('enemySpawn');
  editor.pointerMove(at(-50, 2000));
  assert.deepEqual(editor.tool.preview(), { kind: 'marker', team: 'enemy', x: 0, y: 800, angle: 0, radius: 18 });

  click(editor, at(-50, 2000));
  assert.deepEqual([spawnOf(editor, 's1').x, spawnOf(editor, 's1').y], [0, 800]);
});

// ---- Select tool ---------------------------------------------------------------

const scene = () =>
  makeEditor({
    obstacles: [rect('r', 100, 100, 200, 100), circle('c', 500, 400, 50), rect('thin', 700, 100, 10, 200)],
    spawns: [spawn('s1', 400, 600)],
  });

test('select: click selects what is under the pointer and empty space clears it', () => {
  const editor = scene();
  click(editor, at(150, 150));
  assert.deepEqual(editor.selection, { kind: 'obstacle', id: 'r' });
  click(editor, at(500, 400));
  assert.deepEqual(editor.selection, { kind: 'obstacle', id: 'c' });
  click(editor, at(900, 700));
  assert.equal(editor.selection, null);
  assert.equal(editor.canUndo, false, 'selecting changes nothing');
  assert.equal(editor.dirty, false);
});

test('select: thin walls can be picked a few pixels off', () => {
  const editor = scene();
  click(editor, at(715, 150)); // 5 units right of a 10-wide wall
  assert.deepEqual(editor.selection, { kind: 'obstacle', id: 'thin' });
});

test('select: markers are picked before obstacles, later obstacles before earlier ones', () => {
  const editor = makeEditor({
    obstacles: [rect('under', 100, 100, 200, 200), rect('over', 150, 150, 200, 200)],
    spawns: [spawn('s1', 200, 200)],
  });
  click(editor, at(300, 300));
  assert.equal(editor.selection.id, 'over');
  click(editor, at(200, 200));
  assert.deepEqual(editor.selection, { kind: 'spawn', id: 's1' });
});

test('select: dragging moves the item with snapping, as one undo step', () => {
  const editor = scene();
  drag(editor, at(150, 150), at(205, 183)); // moved by (55, 33)
  assert.deepEqual([obstacle(editor, 'r').x, obstacle(editor, 'r').y], [160, 140]);

  editor.undo();
  assert.deepEqual([obstacle(editor, 'r').x, obstacle(editor, 'r').y], [100, 100]);
  assert.equal(editor.canUndo, false, 'the whole drag was one step');

  editor.redo();
  assert.deepEqual([obstacle(editor, 'r').x, obstacle(editor, 'r').y], [160, 140]);
});

test('select: the map changes live while dragging', () => {
  const editor = scene();
  editor.pointerDown(at(150, 150));
  editor.pointerMove(at(250, 150));
  assert.equal(obstacle(editor, 'r').x, 200);
  editor.pointerUp(at(250, 150));
});

test('select: a drag is kept inside the map', () => {
  const editor = scene();
  drag(editor, at(150, 150), at(2000, 150));
  assert.equal(obstacle(editor, 'r').x, 800); // 1000 - width 200
});

test('select: resizing a rectangle by its corner and edge handles', () => {
  const editor = scene();
  click(editor, at(150, 150)); // select it

  drag(editor, at(300, 200), at(340, 260)); // south-east corner
  let r = obstacle(editor, 'r');
  assert.deepEqual([r.x, r.y, r.w, r.h], [100, 100, 240, 160]);

  drag(editor, at(100, 100), at(80, 60)); // north-west corner
  r = obstacle(editor, 'r');
  assert.deepEqual([r.x, r.y, r.w, r.h], [80, 60, 260, 200]);

  drag(editor, at(340, 160), at(400, 170)); // east edge only changes the width
  r = obstacle(editor, 'r');
  assert.deepEqual([r.x, r.y, r.w, r.h], [80, 60, 320, 200]);
});

test('select: a rectangle cannot be dragged below the minimum size', () => {
  const editor = scene();
  click(editor, at(150, 150));
  drag(editor, at(300, 200), at(101, 101));
  const r = obstacle(editor, 'r');
  assert.deepEqual([r.w, r.h], [10, 10]);
});

test('select: resizing a circle by its handle', () => {
  const editor = scene();
  click(editor, at(500, 400));
  drag(editor, at(550, 400), at(580, 400));
  assert.equal(obstacle(editor, 'c').r, 80);
  editor.undo();
  assert.equal(obstacle(editor, 'c').r, 50);
});

test('select: a spawn can be moved and turned with its handle', () => {
  const editor = scene();
  drag(editor, at(400, 600), at(470, 630)); // moves by (70, 30): snaps to (480, 640)
  assert.deepEqual([spawnOf(editor, 's1').x, spawnOf(editor, 's1').y], [480, 640]);

  drag(editor, at(480 + 44, 640), at(480, 740)); // the turn handle sits 44 units out
  assert.ok(near(spawnOf(editor, 's1').angle, Math.PI / 2));

  drag(editor, at(480, 640 + 44), at(480 + 100, 640 + 40), { shift: true });
  assert.ok(near(spawnOf(editor, 's1').angle, Math.PI / 12));
});

test('select: the player start can be moved', () => {
  const editor = scene();
  drag(editor, at(100, 400), at(200, 500));
  assert.deepEqual(editor.map.playerStart, { x: 200, y: 500, angle: 0 });
});

test('select: Escape during a drag puts everything back without an undo step', () => {
  const editor = scene();
  editor.pointerDown(at(150, 150));
  editor.pointerMove(at(250, 250));
  assert.notEqual(obstacle(editor, 'r').x, 100);

  editor.escape();
  assert.deepEqual([obstacle(editor, 'r').x, obstacle(editor, 'r').y], [100, 100]);
  assert.equal(editor.canUndo, false);
  assert.deepEqual(editor.selection, { kind: 'obstacle', id: 'r' }, 'the first Escape only cancels the drag');

  editor.pointerUp(at(250, 250)); // the late release does nothing
  assert.equal(obstacle(editor, 'r').x, 100);
});

test('select: Delete removes the selection and undo restores it in place', () => {
  const editor = scene();
  click(editor, at(500, 400));
  editor.deleteSelection();
  assert.deepEqual(editor.map.obstacles.map((o) => o.id), ['r', 'thin']);
  assert.equal(editor.selection, null);

  editor.undo();
  assert.deepEqual(editor.map.obstacles.map((o) => o.id), ['r', 'c', 'thin']);
});

test('select: the player start and spawns can be deleted too', () => {
  const editor = scene();
  click(editor, at(100, 400));
  editor.deleteSelection();
  assert.equal(editor.map.playerStart, null);
  editor.undo();
  assert.deepEqual(editor.map.playerStart, { x: 100, y: 400, angle: 0 });

  click(editor, at(400, 600));
  editor.deleteSelection();
  assert.equal(editor.map.spawns.length, 0);
});

test('select: arrow-key nudging moves the selection one grid step', () => {
  const editor = scene();
  click(editor, at(150, 150));
  editor.nudgeSelection(1, 0);
  editor.nudgeSelection(0, -1);
  assert.deepEqual([obstacle(editor, 'r').x, obstacle(editor, 'r').y], [120, 80]);
  editor.undo();
  editor.undo();
  assert.deepEqual([obstacle(editor, 'r').x, obstacle(editor, 'r').y], [100, 100]);
});
