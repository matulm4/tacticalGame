import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentFSM } from '../../src/sim/ai/fsm/AgentFSM.js';
import { AnimateState } from '../../src/sim/ai/fsm/AnimateState.js';
import { GotoState } from '../../src/sim/ai/fsm/GotoState.js';
import { emptyIntent } from '../../src/sim/entities/Intent.js';
import { addDummy, makeSim, rect } from '../../test-support/sim.js';

const DT = 1 / 60;

test('Animate runs its function every tick and ends after its duration', () => {
  const ticks = [];
  const state = new AnimateState({
    duration: 0.5,
    tick: (ctx, elapsed) => {
      ticks.push(elapsed); // returns nothing: only the duration ends this animation
    },
  });
  const intent = emptyIntent();

  for (let i = 0; i < 40; i++) state.update({}, DT, intent);
  assert.equal(state.status, 'done');
  assert.ok(Math.abs(state.elapsed - 0.5) < 0.02, `ended after ${state.elapsed}`);

  const count = ticks.length;
  state.update({}, DT, intent);
  assert.equal(ticks.length, count, 'a finished animation does nothing more');
});

test('Animate ends early when its function says it is finished', () => {
  const state = new AnimateState({ tick: (ctx, elapsed) => elapsed >= 0.1 });
  for (let i = 0; i < 20; i++) state.update({}, DT, emptyIntent());
  assert.equal(state.status, 'done');
});

test('Animate can set what the agent does', () => {
  const state = new AnimateState({ tick: (ctx, elapsed, dt, intent) => { intent.fire = true; intent.aimAngle = 1.5; } });
  const intent = emptyIntent();
  state.update({}, DT, intent);
  assert.deepEqual([intent.fire, intent.aimAngle], [true, 1.5]);
});

test('the state machine has two states and reports which one it is in', () => {
  const fsm = new AgentFSM();
  assert.deepEqual([fsm.kind, fsm.status], ['idle', 'idle']);

  fsm.animate({ tick: () => {} });
  assert.deepEqual([fsm.kind, fsm.status], ['animate', 'running']);

  fsm.goto({ x: 10, y: 10 });
  assert.equal(fsm.kind, 'goto');

  fsm.stop();
  assert.equal(fsm.kind, 'idle');
  fsm.update({}, DT, emptyIntent()); // does nothing, does not crash
});

/** A dummy that walks a Goto state, so the movement system really moves it. */
function walker(sim, target, start) {
  const state = new GotoState(target);
  const agent = addDummy(sim, { x: start.x, y: start.y, def: { speed: 170, turnRate: 4 } });
  agent.controller = {
    getIntent: (self, world, dt) => {
      const intent = emptyIntent(self.aimAngle);
      state.update({ agent: self, world }, dt, intent);
      return intent;
    },
  };
  return { state, agent };
}

test('Goto walks to the destination and reports arrival', () => {
  const sim = makeSim();
  const { state, agent } = walker(sim, { x: 500, y: 600 }, { x: 300, y: 200 });
  for (let i = 0; i < 400 && state.status === 'running'; i++) sim.step();

  assert.equal(state.status, 'arrived');
  assert.ok(Math.hypot(agent.x - 500, agent.y - 600) <= 24);
});

test('Goto goes round walls', () => {
  const sim = makeSim({ obstacles: [rect('wall', 480, 0, 40, 600)] });
  const { state, agent } = walker(sim, { x: 800, y: 200 }, { x: 200, y: 200 });
  for (let i = 0; i < 900 && state.status === 'running'; i++) sim.step();

  assert.equal(state.status, 'arrived');
  assert.ok(Math.hypot(agent.x - 800, agent.y - 200) <= 24);
  assert.ok(state.path.some((p) => p.y > 600), 'it took the gap at the bottom');
});

test('Goto faces the way it walks', () => {
  const sim = makeSim();
  const { agent } = walker(sim, { x: 300, y: 700 }, { x: 300, y: 200 }); // straight down
  for (let i = 0; i < 60; i++) sim.step();
  assert.ok(Math.abs(agent.aimAngle - Math.PI / 2) < 0.2, `aim ${agent.aimAngle}`);
});

test('Goto fails when there is no way to the destination', () => {
  const room = [
    rect('top', 600, 300, 200, 20),
    rect('bottom', 600, 500, 200, 20),
    rect('left', 600, 300, 20, 220),
    rect('right', 780, 300, 20, 220),
  ];
  const sim = makeSim({ obstacles: room });
  const { state } = walker(sim, { x: 700, y: 410 }, { x: 200, y: 200 });
  sim.step();
  assert.equal(state.status, 'failed');
  assert.equal(state.path, null);
});
