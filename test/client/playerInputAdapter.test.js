import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerInputAdapter } from '../../src/client/input/PlayerInputAdapter.js';
import { Camera } from '../../src/client/render/Camera.js';

function fakeInput({ down = [], buttons = [], pressed = [], mouse = { x: 0, y: 0 } } = {}) {
  const queued = new Set(pressed);
  return {
    mouse,
    isDown: (action) => down.includes(action),
    isMouseDown: (button) => buttons.includes(button),
    consumePressed: (action) => queued.delete(action),
  };
}

const camera = () => {
  const c = new Camera({ worldWidth: 1000, worldHeight: 1000, padding: 0 });
  c.resize(500, 500); // scale 0.5
  return c;
};

test('movement keys become axes, opposite keys cancel', () => {
  const adapter = new PlayerInputAdapter(fakeInput({ down: ['moveRight', 'moveUp'] }), camera());
  const input = adapter.read();
  assert.equal(input.moveX, 1);
  assert.equal(input.moveY, -1);

  const cancelled = new PlayerInputAdapter(fakeInput({ down: ['moveLeft', 'moveRight'] }), camera()).read();
  assert.equal(cancelled.moveX, 0);
});

test('the mouse position is converted to a world-space aim point', () => {
  const adapter = new PlayerInputAdapter(fakeInput({ mouse: { x: 250, y: 100 } }), camera());
  const { aimX, aimY } = adapter.read();
  assert.equal(aimX, 500);
  assert.equal(aimY, 200);
});

test('fire follows the left button, crouch follows its key', () => {
  const adapter = new PlayerInputAdapter(fakeInput({ buttons: [0], down: ['crouch'] }), camera());
  const input = adapter.read();
  assert.equal(input.fire, true);
  assert.equal(input.crouch, true);
  assert.equal(new PlayerInputAdapter(fakeInput(), camera()).read().fire, false);
});

test('a reload key press is reported exactly once', () => {
  const adapter = new PlayerInputAdapter(fakeInput({ pressed: ['reload'] }), camera());
  assert.equal(adapter.read().reload, true);
  assert.equal(adapter.read().reload, false);
});
