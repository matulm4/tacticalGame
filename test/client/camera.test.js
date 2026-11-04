import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../../src/client/render/Camera.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

// ---- fit mode (the whole map) -------------------------------------------------

test('fits the world at scale 1 when the view is the world plus padding', () => {
  const camera = new Camera({ worldWidth: 1600, worldHeight: 1000, padding: 16 });
  camera.resize(1632, 1032);
  assert.ok(near(camera.scale, 1));
  assert.ok(near(camera.offsetX, 16));
  assert.ok(near(camera.offsetY, 16));
});

test('scales down to fit a smaller view', () => {
  const camera = new Camera({ worldWidth: 1600, worldHeight: 1000, padding: 0 });
  camera.resize(800, 500);
  assert.ok(near(camera.scale, 0.5));
});

test('letterboxes: the limiting axis fills, the other is centered', () => {
  const camera = new Camera({ worldWidth: 1600, worldHeight: 1000, padding: 0 });
  camera.resize(1600, 1600); // width-limited, scale 1
  assert.ok(near(camera.scale, 1));
  assert.ok(near(camera.offsetX, 0));
  assert.ok(near(camera.offsetY, 300));
});

test('worldToScreen and screenToWorld round-trip', () => {
  const camera = new Camera({ worldWidth: 1600, worldHeight: 1000, padding: 16 });
  camera.resize(1280, 720);
  const world = { x: 321, y: 654 };
  const screen = camera.worldToScreen(world.x, world.y);
  const back = camera.screenToWorld(screen.x, screen.y);
  assert.ok(near(back.x, world.x));
  assert.ok(near(back.y, world.y));
});

test('the world origin and far corner map inside the view', () => {
  const camera = new Camera({ worldWidth: 1600, worldHeight: 1000, padding: 16 });
  camera.resize(1280, 720);
  const origin = camera.worldToScreen(0, 0);
  const corner = camera.worldToScreen(1600, 1000);
  assert.ok(origin.x >= 0 && origin.y >= 0);
  assert.ok(corner.x <= 1280 && corner.y <= 720);
});

test('setWorldSize refits the camera', () => {
  const camera = new Camera({ worldWidth: 1600, worldHeight: 1000, padding: 0 });
  camera.resize(800, 500);
  camera.setWorldSize(800, 500);
  assert.ok(near(camera.scale, 1));
});

test('a tiny view never produces a zero or negative scale', () => {
  const camera = new Camera({ worldWidth: 1600, worldHeight: 1000, padding: 16 });
  camera.resize(10, 10);
  assert.ok(camera.scale > 0);
});

// ---- follow mode (close-up on the player) -------------------------------------

// A 1000x500 px view showing 250 world units vertically: scale 2, so 500x250 world units visible.
const followCamera = (world = { worldWidth: 1600, worldHeight: 1000 }) => {
  const camera = new Camera({ ...world, visibleHeight: 250 });
  camera.resize(1000, 500);
  return camera;
};

test('follow: the zoom comes from the visible height, not the map size', () => {
  const camera = followCamera();
  camera.follow(800, 500);
  assert.ok(near(camera.scale, 2));
});

test('follow: the target sits in the middle of the view', () => {
  const camera = followCamera();
  camera.follow(800, 500);
  const screen = camera.worldToScreen(800, 500);
  assert.ok(near(screen.x, 500) && near(screen.y, 250));
});

test('follow: the view stops at the map edges', () => {
  const camera = followCamera();

  camera.follow(0, 0);
  const topLeft = camera.worldToScreen(0, 0);
  assert.ok(near(topLeft.x, 0) && near(topLeft.y, 0));

  camera.follow(1600, 1000);
  const bottomRight = camera.worldToScreen(1600, 1000);
  assert.ok(near(bottomRight.x, 1000) && near(bottomRight.y, 500));
});

test('follow: a map smaller than the view is centered on that axis', () => {
  const camera = followCamera({ worldWidth: 300, worldHeight: 1000 });
  camera.follow(10, 500);
  const middle = camera.worldToScreen(150, 500);
  assert.ok(near(middle.x, 500), `x ${middle.x}`);
});

test('follow: screen/world conversions round-trip, so aiming stays accurate', () => {
  const camera = followCamera();
  camera.follow(700, 420);
  const screen = camera.worldToScreen(765, 433);
  const back = camera.screenToWorld(screen.x, screen.y);
  assert.ok(near(back.x, 765) && near(back.y, 433));
});

test('follow: resizing keeps following', () => {
  const camera = followCamera();
  camera.follow(800, 500);
  camera.resize(2000, 1000);
  assert.ok(near(camera.scale, 4));
  const screen = camera.worldToScreen(800, 500);
  assert.ok(near(screen.x, 1000) && near(screen.y, 500));
});

test('fitToWorld switches back to the whole-map view', () => {
  const camera = followCamera();
  camera.follow(800, 500);
  camera.fitToWorld();
  assert.equal(camera.mode, 'fit');
  assert.ok(camera.scale < 1);
});
