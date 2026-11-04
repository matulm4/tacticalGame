import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixedStepper } from '../../src/core/FixedStepper.js';

function totalSteps(stepper, frameSeconds, frames) {
  let steps = 0;
  for (let i = 0; i < frames; i++) steps += stepper.advance(frameSeconds).steps;
  return steps;
}

test('a steady 60 fps feed produces about 60 ticks per second', () => {
  const stepper = new FixedStepper({ tickRate: 60 });
  const steps = totalSteps(stepper, 1 / 60, 600);
  assert.ok(Math.abs(steps - 600) <= 1, `got ${steps}`);
});

test('a 144 Hz display still produces 60 ticks per second', () => {
  const stepper = new FixedStepper({ tickRate: 60 });
  const steps = totalSteps(stepper, 1 / 144, 1440); // 10 seconds
  assert.ok(Math.abs(steps - 600) <= 1, `got ${steps}`);
});

test('a 30 fps feed runs two ticks per frame', () => {
  const stepper = new FixedStepper({ tickRate: 60 });
  stepper.advance(1 / 30);
  assert.equal(stepper.advance(1 / 30).steps, 2);
});

test('alpha is the fraction of a tick left in the accumulator', () => {
  const stepper = new FixedStepper({ tickRate: 60 });
  const { steps, alpha } = stepper.advance(stepper.dt * 1.5);
  assert.equal(steps, 1);
  assert.ok(Math.abs(alpha - 0.5) < 1e-9);
});

test('alpha stays within [0, 1)', () => {
  const stepper = new FixedStepper({ tickRate: 60 });
  for (let i = 0; i < 1000; i++) {
    const { alpha } = stepper.advance(0.003 + (i % 7) * 0.004);
    assert.ok(alpha >= 0 && alpha < 1, `alpha ${alpha}`);
  }
});

test('a huge frame is clamped and the backlog is dropped', () => {
  const stepper = new FixedStepper({ tickRate: 60, maxFrameTime: 0.1, maxStepsPerFrame: 5 });
  const { steps } = stepper.advance(10);
  assert.equal(steps, 5);
  assert.ok(stepper.accumulator < stepper.dt);
  // The next normal frame is not burdened by the stall.
  assert.ok(stepper.advance(1 / 60).steps <= 1);
});

test('zero and negative frames produce no ticks', () => {
  const stepper = new FixedStepper({ tickRate: 60 });
  assert.equal(stepper.advance(0).steps, 0);
  assert.equal(stepper.advance(-1).steps, 0);
});

test('timeScale slows the simulation down', () => {
  const stepper = new FixedStepper({ tickRate: 60 });
  stepper.timeScale = 0.5;
  const steps = totalSteps(stepper, 1 / 60, 600);
  assert.ok(Math.abs(steps - 300) <= 1, `got ${steps}`);
});

test('reset clears the accumulator', () => {
  const stepper = new FixedStepper({ tickRate: 60 });
  stepper.advance(stepper.dt * 0.9);
  stepper.reset();
  assert.equal(stepper.accumulator, 0);
});
