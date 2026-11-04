import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Idle } from '../../src/sim/ai/goals/Idle.js';
import { Investigate } from '../../src/sim/ai/goals/Investigate.js';
import { KillEnemy } from '../../src/sim/ai/goals/KillEnemy.js';
import { Rearm } from '../../src/sim/ai/goals/Rearm.js';
import { ReturnToPost } from '../../src/sim/ai/goals/ReturnToPost.js';
import { WorkingMemory } from '../../src/sim/ai/memory/WorkingMemory.js';

// A bare context: just the parts goals look at.
function context(overrides = {}) {
  return {
    memory: new WorkingMemory(),
    now: 10,
    agent: { x: 100, y: 100 },
    home: { x: 100, y: 100 },
    homeNode: 1,
    weapon: { ammo: 30, def: { magSize: 30 } },
    ...overrides,
  };
}

const seeing = (ctx) => ctx.memory.see({ id: 9, x: 300, y: 100 }, ctx.now);

test('KillEnemy applies while there is a threat (in view, or just seen), and wants it dead', () => {
  const goal = new KillEnemy({ priority: 60 });
  const ctx = context({ threat: null });
  assert.equal(goal.relevance(ctx), 0);

  ctx.threat = { id: 9, x: 300, y: 100, visible: true };
  assert.equal(goal.relevance(ctx), 60);
  ctx.threat = { id: 9, x: 300, y: 100, visible: false }; // hiding, but still a threat
  assert.equal(goal.relevance(ctx), 60);
  assert.deepEqual(goal.goalState(ctx).toObject(), { TargetDead: 1 });
});

test('Investigate applies to an unchecked noise, and says why', () => {
  const goal = new Investigate({ priority: 40 });
  const ctx = context();
  assert.equal(goal.relevance(ctx), 0, 'nothing to investigate');

  ctx.memory.hear({ kind: 'gunshot', x: 500, y: 100, distance: 400 }, 9);
  assert.equal(goal.relevance(ctx), 40);
  assert.equal(goal.tag(ctx), 'noise');
  assert.deepEqual(goal.goalState(ctx).toObject(), { Investigated: 1 });
});

test('Investigate applies to where a hostile was last seen, and says so', () => {
  const goal = new Investigate({ priority: 40 });
  const ctx = context();
  ctx.memory.see({ id: 9, x: 300, y: 100 }, 9);
  ctx.memory.loseSight();
  assert.equal(goal.relevance(ctx), 40);
  assert.equal(goal.tag(ctx), 'lostSight');
});

test('Investigate steps aside while a hostile is in view, and once everything is checked', () => {
  const goal = new Investigate({ priority: 40 });
  const ctx = context();
  ctx.memory.hear({ kind: 'gunshot', x: 500, y: 100, distance: 400 }, 9);

  seeing(ctx);
  assert.equal(goal.relevance(ctx), 0, 'fighting comes first');

  ctx.memory.loseSight();
  assert.equal(goal.relevance(ctx), 40);
  ctx.memory.markInvestigated(ctx.now);
  assert.equal(goal.relevance(ctx), 0);
});

test('Rearm applies when nothing is in view and the magazine is not full', () => {
  const goal = new Rearm({ priority: 30 });
  assert.equal(goal.relevance(context()), 0, 'full magazine');

  const half = context({ weapon: { ammo: 12, def: { magSize: 30 } } });
  assert.equal(goal.relevance(half), 30);
  assert.deepEqual(goal.goalState(half).toObject(), { WeaponFull: 1 });

  seeing(half);
  assert.equal(goal.relevance(half), 0, 'no time while fighting');
});

test('ReturnToPost applies when the agent is away from its post, and wants to be at its node', () => {
  const goal = new ReturnToPost({ priority: 25 });
  assert.equal(goal.relevance(context()), 0);
  assert.equal(goal.relevance(context({ agent: { x: 130, y: 100 } })), 0, '30 away is still at the post');

  const away = context({ agent: { x: 400, y: 100 }, homeNode: 7 });
  assert.equal(goal.relevance(away), 25);
  assert.deepEqual(goal.goalState(away).toObject(), { AtNode: 7 });
});

test('Idle always applies, with the lowest priority, and is never satisfied', () => {
  const goal = new Idle({ priority: 1 });
  assert.equal(goal.relevance(context()), 1);
  assert.deepEqual(goal.goalState(context()).toObject(), { OnWatch: 1 });
});
