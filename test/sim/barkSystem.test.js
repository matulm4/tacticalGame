import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BARKS } from '../../src/sim/ai/dialogue/barks.js';
import { BarkSystem } from '../../src/sim/ai/dialogue/BarkSystem.js';

// A stand-in world that records the events emitted into it.
function fakeWorld() {
  const events = [];
  return {
    time: 0,
    events,
    rng: { pick: (array) => array[0] },
    emit: (type, payload) => events.push({ type, ...payload }),
  };
}
const agent = (id) => ({ id, x: 10 * id, y: 20 });

test('speaking emits a bark event with the line and the speaker', () => {
  const world = fakeWorld();
  const spoke = new BarkSystem().say(world, agent(1), ['Attack']);

  assert.equal(spoke, true);
  assert.deepEqual(world.events, [{ type: 'bark', agentId: 1, text: BARKS.Attack[0], x: 10, y: 20 }]);
});

test('the most specific key with a line wins', () => {
  const world = fakeWorld();
  new BarkSystem().say(world, agent(1), ['InvestigatePoint:lostSight', 'InvestigatePoint']);
  assert.equal(world.events[0].text, BARKS['InvestigatePoint:lostSight'][0]);
});

test('later keys are tried when earlier ones have no line', () => {
  const world = fakeWorld();
  new BarkSystem().say(world, agent(1), ['GotoNode:NoSuchGoal', 'Reload']);
  assert.equal(world.events[0].text, BARKS.Reload[0]);
});

test('an action with no line stays quiet', () => {
  const world = fakeWorld();
  assert.equal(new BarkSystem().say(world, agent(1), ['NoSuchAction']), false);
  assert.equal(world.events.length, 0);
});

test('one agent does not talk again straight away', () => {
  const world = fakeWorld();
  const barks = new BarkSystem({ agentGap: 1.5, repeatGap: 0, globalGap: 0 });
  assert.equal(barks.say(world, agent(1), ['Attack']), true);

  world.time = 1;
  assert.equal(barks.say(world, agent(1), ['Reload']), false, 'too soon');
  world.time = 1.6;
  assert.equal(barks.say(world, agent(1), ['Reload']), true);
});

test('a more important line is not held back by what the agent just said', () => {
  const world = fakeWorld();
  const barks = new BarkSystem({ agentGap: 1.5, repeatGap: 0, globalGap: 0 });
  assert.equal(barks.say(world, agent(1), ['LookAtNoise'], 0), true);

  world.time = 0.5;
  assert.equal(barks.say(world, agent(1), ['Reload'], 0), false, 'same importance: wait');
  assert.equal(barks.say(world, agent(1), ['Attack'], 1), true, 'a combat callout goes straight through');

  world.time = 0.8;
  assert.equal(barks.say(world, agent(1), ['Reload'], 0), false, 'idle chatter does not interrupt it');
});

test('the same line is not repeated for a while', () => {
  const world = fakeWorld();
  const barks = new BarkSystem({ agentGap: 0, repeatGap: 8, globalGap: 0 });
  assert.equal(barks.say(world, agent(1), ['Attack']), true);

  world.time = 3;
  assert.equal(barks.say(world, agent(1), ['Attack']), false, 'same line, too soon');
  assert.equal(barks.say(world, agent(1), ['Reload']), true, 'a different line is fine');

  world.time = 9;
  assert.equal(barks.say(world, agent(1), ['Attack']), true, 'long enough has passed');
});

test('the world leaves a short gap between any two lines', () => {
  const world = fakeWorld();
  const barks = new BarkSystem({ agentGap: 0, repeatGap: 0, globalGap: 0.3 });
  assert.equal(barks.say(world, agent(1), ['Attack']), true);
  assert.equal(barks.say(world, agent(2), ['Reload']), false, 'two at once would overlap');

  world.time = 0.4;
  assert.equal(barks.say(world, agent(2), ['Reload']), true);
});

test('every line the actions can ask for exists', () => {
  for (const [key, lines] of Object.entries(BARKS)) {
    assert.ok(Array.isArray(lines) && lines.length > 0, key);
    assert.ok(lines.every((line) => typeof line === 'string' && line.length > 0), key);
  }
});
