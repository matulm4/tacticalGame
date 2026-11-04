import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Attack } from '../../src/sim/ai/actions/Attack.js';
import { Reload } from '../../src/sim/ai/actions/Reload.js';
import { Action } from '../../src/sim/ai/planning/Action.js';
import { Planner } from '../../src/sim/ai/planning/Planner.js';
import { WorldState } from '../../src/sim/ai/planning/WorldState.js';
import { PARAM } from '../../src/sim/ai/planning/worldStateSchema.js';

/** A bare action for planner tests: preconditions, effects and cost are the whole point. */
class TestAction extends Action {
  constructor({ id, cost = 1, pre = {}, eff = {}, check = () => true }) {
    super();
    this.id = id;
    this.cost = cost;
    this.preconditions = WorldState.from(pre);
    this.effects = WorldState.from(eff);
    this.check = check;
  }

  checkProceduralPreconditions(ctx, bindings) {
    return this.check(ctx, bindings);
  }
}

const planner = new Planner();
const ids = (result) => result.steps.map((step) => step.action.id);

// ---- the paper's own example -----------------------------------------------

test('an empty weapon turns "attack" into "reload, then attack"', () => {
  const current = WorldState.from({ TargetVisible: true, WeaponLoaded: false, InCover: false });
  const result = planner.plan(current, WorldState.from({ TargetDead: true }), [new Attack(), new Reload()], {});
  assert.deepEqual(ids(result), ['Reload', 'Attack']);
  assert.equal(result.cost, 3); // Reload 2 + Attack 1
});

test('with a loaded weapon the plan is just "attack"', () => {
  const current = WorldState.from({ TargetVisible: true, WeaponLoaded: true, InCover: false });
  const result = planner.plan(current, WorldState.from({ TargetDead: true }), [new Attack(), new Reload()], {});
  assert.deepEqual(ids(result), ['Attack']);
});

test('no plan when nothing can provide a missing precondition', () => {
  // The target is not visible, and no action makes it visible.
  const current = WorldState.from({ TargetVisible: false, WeaponLoaded: true });
  assert.equal(planner.plan(current, WorldState.from({ TargetDead: true }), [new Attack(), new Reload()], {}), null);
});

test('no plan when the agent has no action for the goal', () => {
  const current = WorldState.from({ TargetVisible: true, WeaponLoaded: true });
  assert.equal(planner.plan(current, WorldState.from({ Investigated: true }), [new Attack(), new Reload()], {}), null);
});

test('a goal that already holds needs no steps', () => {
  const current = WorldState.from({ WeaponLoaded: true });
  const result = planner.plan(current, WorldState.from({ WeaponLoaded: true }), [new Reload()], {});
  assert.deepEqual(result, { steps: [], cost: 0, expansions: 0 });
});

// ---- choosing between plans ------------------------------------------------

test('picks the cheapest action when several reach the goal', () => {
  const expensive = new TestAction({ id: 'expensive', cost: 5, eff: { Investigated: true } });
  const cheap = new TestAction({ id: 'cheap', cost: 2, eff: { Investigated: true } });
  const result = planner.plan(new WorldState(), WorldState.from({ Investigated: true }), [expensive, cheap], {});
  assert.deepEqual(ids(result), ['cheap']);
});

test('falls back to the dearer action when the cheap one cannot be used', () => {
  const cheapButBlocked = new TestAction({ id: 'cheap', cost: 2, pre: { OnWatch: true }, eff: { Investigated: true } });
  const dear = new TestAction({ id: 'dear', cost: 5, eff: { Investigated: true } });
  const current = WorldState.from({ OnWatch: false });
  const result = planner.plan(current, WorldState.from({ Investigated: true }), [cheapButBlocked, dear], {});
  assert.deepEqual(ids(result), ['dear']);
});

test('a longer chain wins when its total cost is lower', () => {
  const direct = new TestAction({ id: 'direct', cost: 10, eff: { Investigated: true } });
  const stepOne = new TestAction({ id: 'stepOne', cost: 3, eff: { OnWatch: true } });
  const stepTwo = new TestAction({ id: 'stepTwo', cost: 3, pre: { OnWatch: true }, eff: { Investigated: true } });
  const current = WorldState.from({ OnWatch: false });
  const result = planner.plan(current, WorldState.from({ Investigated: true }), [direct, stepOne, stepTwo], {});
  assert.deepEqual(ids(result), ['stepOne', 'stepTwo']);
  assert.equal(result.cost, 6);
});

test('a procedural precondition can rule an action out, sending the planner elsewhere', () => {
  let asked = 0;
  const walk = new TestAction({ id: 'walk', cost: 1, eff: { Investigated: true }, check: () => (asked++, false) });
  const look = new TestAction({ id: 'look', cost: 6, eff: { Investigated: true } });
  const result = planner.plan(new WorldState(), WorldState.from({ Investigated: true }), [walk, look], {});
  assert.deepEqual(ids(result), ['look']);
  assert.ok(asked > 0, 'the check actually ran');
});

test('procedural preconditions get the context given to the planner', () => {
  const seen = [];
  const action = new TestAction({ id: 'a', eff: { Investigated: true }, check: (ctx) => (seen.push(ctx), true) });
  const ctx = { marker: 42 };
  planner.plan(new WorldState(), WorldState.from({ Investigated: true }), [action], ctx);
  assert.deepEqual(seen, [ctx]);
});

// ---- variable effects (PARAM) ----------------------------------------------

test('a PARAM effect satisfies whichever value the goal asks for, and reports it', () => {
  const goto = new TestAction({ id: 'goto', cost: 3, eff: { AtNode: PARAM } });
  const result = planner.plan(WorldState.from({ AtNode: 0 }), WorldState.from({ AtNode: 7 }), [goto], {});
  assert.deepEqual(ids(result), ['goto']);
  assert.deepEqual(result.steps[0].bindings, { AtNode: 7 });
});

test('the PARAM binding reaches the procedural precondition', () => {
  const bound = [];
  const goto = new TestAction({ id: 'goto', eff: { AtNode: PARAM }, check: (ctx, bindings) => (bound.push(bindings.AtNode), true) });
  planner.plan(WorldState.from({ AtNode: 0 }), WorldState.from({ AtNode: 5 }), [goto], {});
  assert.deepEqual(bound, [5]);
});

test('no walking needed when the agent is already at the wanted node', () => {
  const goto = new TestAction({ id: 'goto', eff: { AtNode: PARAM } });
  const result = planner.plan(WorldState.from({ AtNode: 7 }), WorldState.from({ AtNode: 7 }), [goto], {});
  assert.deepEqual(result.steps, []);
});

// ---- things the planner must not do ----------------------------------------

test('does not use an action whose effect leaves a needed variable at the wrong value', () => {
  const clobbers = new TestAction({ id: 'bad', eff: { Investigated: false } });
  assert.equal(planner.plan(new WorldState(), WorldState.from({ Investigated: true }), [clobbers], {}), null);
});

test('does not use an action whose precondition contradicts another need', () => {
  // Attack needs TargetVisible, the helper insists on TargetVisible = false.
  const helper = new TestAction({ id: 'helper', pre: { TargetVisible: false }, eff: { WeaponLoaded: true } });
  const current = WorldState.from({ TargetVisible: true, WeaponLoaded: false });
  assert.equal(planner.plan(current, WorldState.from({ TargetDead: true }), [new Attack(), helper], {}), null);
});

test('does not use an action that helps with nothing', () => {
  const useless = new TestAction({ id: 'useless', eff: { OnWatch: true } });
  assert.equal(planner.plan(new WorldState(), WorldState.from({ Investigated: true }), [useless], {}), null);
});

test('gives up when the search budget or plan length is exceeded', () => {
  const stepOne = new TestAction({ id: 'one', eff: { OnWatch: true } });
  const stepTwo = new TestAction({ id: 'two', pre: { OnWatch: true }, eff: { Investigated: true } });
  const goal = WorldState.from({ Investigated: true });
  const current = WorldState.from({ OnWatch: false });

  assert.ok(new Planner().plan(current, goal, [stepOne, stepTwo], {}), 'a two-step plan is found normally');
  assert.equal(new Planner({ maxDepth: 1 }).plan(current, goal, [stepOne, stepTwo], {}), null);
  assert.equal(new Planner({ maxExpansions: 1 }).plan(current, goal, [stepOne, stepTwo], {}), null);
});

test('planning is deterministic', () => {
  const a = new TestAction({ id: 'a', cost: 2, eff: { Investigated: true } });
  const b = new TestAction({ id: 'b', cost: 2, eff: { Investigated: true } });
  const run = () => ids(planner.plan(new WorldState(), WorldState.from({ Investigated: true }), [a, b], {}));
  assert.deepEqual(run(), run());
  assert.deepEqual(run(), ['a'], 'ties go to the earlier action');
});

test('the current world state is never modified', () => {
  const current = WorldState.from({ TargetVisible: true, WeaponLoaded: false });
  const before = current.key();
  planner.plan(current, WorldState.from({ TargetDead: true }), [new Attack(), new Reload()], {});
  assert.equal(current.key(), before);
});
