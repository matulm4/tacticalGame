import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyMap, validateMap } from '../../src/sim/map/mapSchema.js';

const validMap = () => ({
  version: 1,
  name: 'm',
  width: 1000,
  height: 800,
  obstacles: [
    { id: 'a', shape: 'rect', x: 10, y: 10, w: 50, h: 20 },
    { id: 'b', shape: 'circle', cx: 200, cy: 200, r: 30, height: 'low' },
  ],
  playerStart: { x: 100, y: 100 },
  spawns: [{ id: 's1', type: 'grunt', x: 500, y: 500 }],
});

test('a valid map passes and defaults are filled in', () => {
  const { ok, map } = validateMap(validMap());
  assert.ok(ok);
  assert.equal(map.obstacles[0].height, 'high');
  assert.equal(map.playerStart.angle, 0);
  assert.equal(map.spawns[0].team, 'enemy');
  assert.equal(map.spawns[0].angle, 0);
});

test('the empty map is valid, with no player start yet', () => {
  const { ok, map } = validateMap(createEmptyMap());
  assert.ok(ok);
  assert.equal(map.playerStart, null);
});

test('validation returns a clean copy and drops unknown keys', () => {
  const input = validMap();
  input.obstacles[0].junk = true;
  const { map } = validateMap(input);
  assert.ok(!('junk' in map.obstacles[0]));
  assert.notEqual(map.obstacles[0], input.obstacles[0]);
});

function errorsFor(mutate) {
  const input = validMap();
  mutate(input);
  const result = validateMap(input);
  assert.equal(result.ok, false);
  assert.equal(result.map, null);
  return result.errors.join(' | ');
}

test('rejects bad top-level values', () => {
  assert.equal(validateMap(null).ok, false);
  assert.equal(validateMap([]).ok, false);
  assert.match(errorsFor((m) => { m.version = 2; }), /version/);
  assert.match(errorsFor((m) => { m.width = 50; }), /width/);
  assert.match(errorsFor((m) => { m.height = NaN; }), /height/);
});

test('rejects bad obstacles', () => {
  assert.match(errorsFor((m) => { m.obstacles[1].id = 'a'; }), /duplicated/);
  assert.match(errorsFor((m) => { m.obstacles[0].shape = 'hexagon'; }), /shape/);
  assert.match(errorsFor((m) => { m.obstacles[0].w = -5; }), /positive/);
  assert.match(errorsFor((m) => { m.obstacles[1].r = 0; }), /positive/);
  assert.match(errorsFor((m) => { m.obstacles[0].height = 'tall'; }), /height/);
  assert.match(errorsFor((m) => { m.obstacles[0].id = ''; }), /id/);
});

test('rejects bad player start and spawns', () => {
  assert.match(errorsFor((m) => { m.playerStart = { x: 'a', y: 1 }; }), /playerStart/);
  assert.match(errorsFor((m) => { m.spawns.push({ id: 's1', type: 'grunt', x: 1, y: 1 }); }), /duplicated/);
  assert.match(errorsFor((m) => { m.spawns[0].type = ''; }), /type/);
  assert.match(errorsFor((m) => { m.spawns[0].x = Infinity; }), /numeric/);
});
