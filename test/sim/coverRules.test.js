import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obstacleBlocks } from '../../src/sim/map/coverRules.js';

test('high cover always blocks', () => {
  for (const sourceCrouched of [false, true]) {
    for (const targetCrouched of [false, true]) {
      for (const blind of [false, true]) {
        assert.equal(obstacleBlocks('high', { sourceCrouched, targetCrouched, blind }), true);
      }
    }
  }
});

test('low cover: standing agents see and shoot each other over it', () => {
  assert.equal(obstacleBlocks('low', {}), false);
});

test('low cover hides a crouched target', () => {
  assert.equal(obstacleBlocks('low', { targetCrouched: true }), true);
});

test('low cover stops a crouched shooter from firing over it', () => {
  assert.equal(obstacleBlocks('low', { sourceCrouched: true }), true);
  assert.equal(obstacleBlocks('low', { sourceCrouched: true, targetCrouched: true }), true);
});

test('blind fire passes over low cover, but not to a crouched target', () => {
  assert.equal(obstacleBlocks('low', { sourceCrouched: true, blind: true }), false);
  assert.equal(obstacleBlocks('low', { sourceCrouched: true, targetCrouched: true, blind: true }), true);
});

test('unknown heights are an error', () => {
  assert.throws(() => obstacleBlocks('medium'), /Unknown cover height/);
});
