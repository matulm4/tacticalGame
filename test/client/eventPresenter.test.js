import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventPresenter } from '../../src/client/render/EventPresenter.js';

const at = (type, time, extra = {}) => ({ type, time, x: 10, y: 20, ...extra });

test('shots, hits, sounds, wounds and deaths each become an effect', () => {
  const presenter = new EventPresenter();
  presenter.handle([
    at('shotFired', 1),
    at('bulletHit', 1.1, { kind: 'wall' }),
    at('soundEmitted', 1.2, { kind: 'gunshot', radius: 600 }),
    at('agentDamaged', 1.3, { radius: 18 }),
    at('agentDied', 1.4, { radius: 18, team: 'enemy' }),
  ]);

  assert.deepEqual(presenter.effects.map((e) => e.kind), ['muzzle', 'spark', 'sound', 'hit', 'corpse']);
  assert.equal(presenter.effects[2].radius, 600);
  assert.equal(presenter.effects[4].team, 'enemy');
  assert.deepEqual(presenter.effects.map((e) => e.born), [1, 1.1, 1.2, 1.3, 1.4]);
});

test('a chatter line becomes a speech bubble, and a new line replaces the old one', () => {
  const presenter = new EventPresenter();
  presenter.handle([
    { type: 'bark', time: 1, agentId: 5, text: 'Reloading!' },
    { type: 'bark', time: 1.1, agentId: 6, text: 'Moving!' },
  ]);
  presenter.handle([{ type: 'bark', time: 3, agentId: 5, text: 'Opening fire!' }]);

  const bubbles = presenter.effects.filter((e) => e.kind === 'bubble');
  assert.deepEqual(bubbles.map((b) => [b.agentId, b.text]), [[6, 'Moving!'], [5, 'Opening fire!']]);
  assert.equal(bubbles[1].born, 3);
});

test('other events are ignored', () => {
  const presenter = new EventPresenter();
  presenter.handle([{ type: 'reloadStarted', time: 1 }, { type: 'matchEnded', time: 2, outcome: 'win' }]);
  assert.equal(presenter.effects.length, 0);
});

test('prune drops effects once they have run their course', () => {
  const presenter = new EventPresenter();
  presenter.handle([at('shotFired', 1), at('soundEmitted', 1, { radius: 100 })]);

  presenter.prune(1.03); // a muzzle flash lasts 0.06 s, a sound ring 0.7 s
  assert.deepEqual(presenter.effects.map((e) => e.kind), ['muzzle', 'sound']);

  presenter.prune(1.2);
  assert.deepEqual(presenter.effects.map((e) => e.kind), ['sound']);

  presenter.prune(5);
  assert.equal(presenter.effects.length, 0);
});

test('clear forgets everything (used when the match restarts)', () => {
  const presenter = new EventPresenter();
  presenter.handle([at('shotFired', 1)]);
  presenter.clear();
  assert.equal(presenter.effects.length, 0);
});
