import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintMap } from '../../src/editor/mapLint.js';
import { makeMap, rect, spawn } from '../../test-support/sim.js';

const goodMap = () => makeMap({ spawns: [spawn('s1', 800, 400)] });
const messages = (issues) => issues.map((issue) => `${issue.severity}: ${issue.message}`);

test('a playable map with an enemy has no issues', () => {
  assert.deepEqual(lintMap(goodMap()), []);
});

test('no player start is an error', () => {
  const issues = lintMap(makeMap({ playerStart: null, spawns: [spawn('s1', 800, 400)] }));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, 'error');
});

test('no enemies is only a warning', () => {
  const issues = lintMap(makeMap());
  assert.deepEqual(issues.map((i) => i.severity), ['warning']);
});

test('a start or spawn inside a wall, or outside the map, is a warning that names the culprit', () => {
  const wall = rect('wall', 50, 350, 100, 100);
  const issues = lintMap(
    makeMap({
      obstacles: [wall],
      spawns: [spawn('s1', 800, 400), spawn('s2', 90, 400), spawn('s3', 5000, 5000)],
    }),
  );
  assert.equal(issues.length, 3, messages(issues).join(' | '));
  assert.ok(issues.every((i) => i.severity === 'warning'));
  assert.deepEqual(issues.map((i) => i.target), [
    { kind: 'playerStart', id: 'playerStart' },
    { kind: 'spawn', id: 's2' },
    { kind: 'spawn', id: 's3' },
  ]);
});

test('an unknown enemy type is an error', () => {
  const issues = lintMap(makeMap({ spawns: [spawn('s1', 800, 400, { type: 'dragon' })] }));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, 'error');
  assert.match(issues[0].message, /dragon/);
});
