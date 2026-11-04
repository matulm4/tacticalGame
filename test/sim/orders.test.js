import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CoverReservations } from '../../src/sim/ai/cover/CoverReservations.js';
import { GOAL_SETS } from '../../src/sim/ai/data/goalSets.js';
import { BarkSystem } from '../../src/sim/ai/dialogue/BarkSystem.js';
import { WorkingMemory } from '../../src/sim/ai/memory/WorkingMemory.js';
import { Planner } from '../../src/sim/ai/planning/Planner.js';
import { WorldState } from '../../src/sim/ai/planning/WorldState.js';
import { ACTION_SETS } from '../../src/sim/ai/data/actionSets.js';
import { gotoCoverOrder, searchOrder, suppressOrder } from '../../src/sim/ai/squad/Orders.js';
import { squadInfo } from '../../src/sim/debug/DebugProbe.js';
import { Simulation } from '../../src/sim/world/Simulation.js';
import { makeMap, run, spawn } from '../../test-support/sim.js';

const node = { id: 'n1', x: 100, y: 100 };
const info = { behavior: 'getToCover', squadId: 1, now: 10, timeout: 8 };

// ---- orders in memory --------------------------------------------------------------------

test('an order is active until it is carried out or runs out', () => {
  const memory = new WorkingMemory();
  assert.equal(memory.activeOrder(10), null);

  const order = gotoCoverOrder({ ...info, node });
  memory.giveOrder(order);
  assert.equal(memory.activeOrder(12), order);
  assert.equal(memory.activeOrder(18), null, 'expired after its timeout');

  memory.completeOrder();
  assert.equal(memory.activeOrder(12), null);
  assert.equal(memory.order.fulfilled, true);

  memory.clearOrder();
  assert.equal(memory.order, null);
});

test('a new order replaces the old one', () => {
  const memory = new WorkingMemory();
  memory.giveOrder(gotoCoverOrder({ ...info, node }));
  const search = searchOrder({ ...info, behavior: 'search', point: { x: 1, y: 2 } });
  memory.giveOrder(search);
  assert.equal(memory.activeOrder(11), search);
});

test('each order type carries what it needs', () => {
  assert.equal(gotoCoverOrder({ ...info, node }).node, node);
  assert.deepEqual(suppressOrder({ ...info, target: { x: 3, y: 4 } }).target, { x: 3, y: 4 });
  const order = searchOrder({ ...info, point: { x: 5, y: 6 } });
  assert.deepEqual(order.point, { x: 5, y: 6 });
  assert.equal(order.expiresAt, 18);
  assert.equal(order.fulfilled, false);
});

test('an alert counts only if it is newer than what the agent already knows', () => {
  const memory = new WorkingMemory();
  memory.alert({ id: 1, x: 10, y: 10, time: 5 });
  assert.deepEqual(memory.lastKnown, { id: 1, x: 10, y: 10, time: 5 });

  memory.alert({ id: 1, x: 99, y: 99, time: 3 });
  assert.equal(memory.lastKnown.x, 10, 'older news is ignored');

  memory.see({ id: 1, x: 20, y: 20 }, 7);
  memory.alert({ id: 1, x: 99, y: 99, time: 7 });
  assert.equal(memory.lastKnown.x, 20, 'what it saw itself is kept on a tie');
});

// ---- planning for orders -----------------------------------------------------------------

function ctxWith(order) {
  return {
    order,
    agent: { x: 0, y: 0 },
    world: { nav: { findPath: () => [{ x: 0, y: 0 }] } },
  };
}

const planFor = (actionSet, order, current = {}) => {
  const state = WorldState.from({ OrderPending: true, WeaponLoaded: true, ...current });
  const goal = WorldState.from({ OrderPending: false });
  const result = new Planner().plan(state, goal, ACTION_SETS[actionSet](), ctxWith(order));
  return result?.steps.map((step) => step.action.id) ?? null;
};

test('each order is carried out by the action that fits it', () => {
  assert.deepEqual(planFor('soldier', gotoCoverOrder({ ...info, node })), ['MoveToCover']);
  assert.deepEqual(planFor('soldier', suppressOrder({ ...info, target: { x: 1, y: 1 } })), ['SuppressFire']);
  assert.deepEqual(planFor('soldier', searchOrder({ ...info, point: { x: 1, y: 1 } })), ['SearchPoint']);
});

test('to suppress with an empty gun, the agent reloads first', () => {
  const order = suppressOrder({ ...info, target: { x: 1, y: 1 } });
  assert.deepEqual(planFor('soldier', order, { WeaponLoaded: false }), ['Reload', 'SuppressFire']);
});

test('an agent that cannot walk can suppress, but cannot be ordered to move or search', () => {
  assert.deepEqual(planFor('stationary', suppressOrder({ ...info, target: { x: 1, y: 1 } })), ['SuppressFire']);
  assert.equal(planFor('stationary', gotoCoverOrder({ ...info, node })), null);
  assert.equal(planFor('stationary', searchOrder({ ...info, point: { x: 1, y: 1 } })), null);
});

test('an order outranks fighting and cover, but not dodging', () => {
  const priority = Object.fromEntries(GOAL_SETS.soldier().map((goal) => [goal.id, goal.priority]));
  assert.ok(priority.Dodge > priority.FollowOrder);
  assert.ok(priority.FollowOrder > priority.Cover && priority.FollowOrder > priority.KillEnemy);
});

// ---- cover reservations ------------------------------------------------------------------

test('a claimed cover position is taken for everyone else, until the claim lapses', () => {
  const claims = new CoverReservations();
  assert.equal(claims.claim('c1', 7, 0), true);
  assert.equal(claims.isTaken('c1', 8, 1), true);
  assert.equal(claims.isTaken('c1', 7, 1), false, 'not taken for its holder');
  assert.equal(claims.claim('c1', 8, 1), false);
  assert.equal(claims.isTaken('c1', 8, 10), false, 'a claim nobody refreshes lapses');
  assert.equal(claims.claim('c1', 8, 10), true);
});

test('the holder keeps a claim by refreshing it, and can drop all of its claims', () => {
  const claims = new CoverReservations();
  claims.claim('c1', 7, 0);
  claims.claim('c1', 7, 3);
  assert.equal(claims.isTaken('c1', 8, 5), true, 'refreshed at 3, still held at 5');

  claims.claim('c2', 7, 3);
  claims.release(7);
  assert.equal(claims.isTaken('c1', 8, 5), false);
  assert.equal(claims.isTaken('c2', 8, 5), false);
});

// ---- chatter -------------------------------------------------------------------------------

test('an order shout is heard over other chatter in the same moment', () => {
  const events = [];
  const world = { time: 0, rng: { pick: (a) => a[0] }, emit: (type, payload) => events.push({ type, ...payload }) };
  const barks = new BarkSystem();
  assert.equal(barks.say(world, { id: 1, x: 0, y: 0 }, ['Reload'], 0), true);
  assert.equal(barks.say(world, { id: 2, x: 0, y: 0 }, ['SuppressFire'], 2), true, 'higher priority skips the world gap');
  assert.equal(barks.say(world, { id: 3, x: 0, y: 0 }, ['LookAround'], 0), false, 'ordinary chatter still waits');
});

// ---- the debug probe -------------------------------------------------------------------------

test('squadInfo lists each squad with its members, behavior and what it knows', () => {
  const sim = new Simulation(
    makeMap({ spawns: [spawn('a', 700, 300), spawn('b', 700, 360), spawn('c', 100, 700)] }),
    { seed: 1 },
  );
  run(sim, 2);
  const squads = squadInfo(sim.world);
  assert.equal(squads.length, 2);
  const pair = squads.find((squad) => squad.members.length === 2);
  assert.equal(pair.behavior, null);
  assert.equal(pair.sighting, null);
  assert.ok(pair.members.every((m) => 'agentId' in m && 'x' in m && 'order' in m));
});
