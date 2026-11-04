import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldState } from '../../src/sim/ai/planning/WorldState.js';
import { PARAM, UNSET, VAR, VARIABLES } from '../../src/sim/ai/planning/worldStateSchema.js';

test('every variable has its own slot', () => {
  assert.equal(new Set(Object.values(VAR)).size, VARIABLES.length);
  VARIABLES.forEach((name, index) => assert.equal(VAR[name], index));
});

test('a new state has nothing set', () => {
  const state = new WorldState();
  assert.equal(state.values.length, VARIABLES.length);
  assert.ok(state.values.every((value) => value === UNSET));
  assert.deepEqual(state.toObject(), {});
});

test('from() turns booleans into 0 and 1 and keeps numbers', () => {
  const state = WorldState.from({ TargetVisible: true, WeaponLoaded: false, AtNode: 4 });
  assert.equal(state.get('TargetVisible'), 1);
  assert.equal(state.get('WeaponLoaded'), 0);
  assert.equal(state.get('AtNode'), 4);
  assert.equal(state.get('OnWatch'), UNSET);
  assert.deepEqual(state.toObject(), { TargetVisible: 1, WeaponLoaded: 0, AtNode: 4 });
});

test('PARAM can be stored as an effect value', () => {
  assert.equal(WorldState.from({ AtNode: PARAM }).get('AtNode'), PARAM);
});

test('unknown variable names are an error', () => {
  assert.throws(() => WorldState.from({ Hunger: true }), /Unknown world state variable/);
  assert.throws(() => new WorldState().get('Hunger'), /Unknown world state variable/);
});

test('a clone is independent of the original', () => {
  const original = WorldState.from({ TargetVisible: true });
  const copy = original.clone();
  copy.set('TargetVisible', false);
  assert.equal(original.get('TargetVisible'), 1);
  assert.equal(copy.get('TargetVisible'), 0);
});

test('equal states have equal keys, different states do not', () => {
  const a = WorldState.from({ TargetVisible: true, AtNode: 2 });
  const b = WorldState.from({ AtNode: 2, TargetVisible: true });
  const c = WorldState.from({ TargetVisible: true, AtNode: 3 });
  assert.equal(a.key(), b.key());
  assert.notEqual(a.key(), c.key());
});
