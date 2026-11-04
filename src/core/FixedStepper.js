// Fixed-timestep accumulator. Pure (no timers, no DOM) so it can be unit-tested
// and reused to drive a simulation on a server.
//
// Usage per rendered frame:
//   const { steps, alpha } = stepper.advance(frameSeconds);
//   for (let i = 0; i < steps; i++) simulation.step(stepper.dt);
//   render(alpha); // alpha in [0, 1): how far we are between the last two ticks

const EPSILON = 1e-9;

export class FixedStepper {
  /**
   * @param {object} [options]
   * @param {number} [options.tickRate=60]        simulation ticks per second
   * @param {number} [options.maxFrameTime=0.1]   longest real frame we honor (seconds)
   * @param {number} [options.maxStepsPerFrame=8] spiral-of-death guard
   */
  constructor({ tickRate = 60, maxFrameTime = 0.1, maxStepsPerFrame = 8 } = {}) {
    this.dt = 1 / tickRate;
    this.maxFrameTime = maxFrameTime;
    this.maxStepsPerFrame = maxStepsPerFrame;
    this.timeScale = 1;
    this.accumulator = 0;
  }

  /**
   * Feed one real frame's duration.
   * @param {number} frameSeconds
   * @returns {{steps: number, alpha: number}}
   */
  advance(frameSeconds) {
    const frame = Math.min(Math.max(frameSeconds, 0), this.maxFrameTime);
    this.accumulator += frame * this.timeScale;

    let steps = 0;
    while (this.accumulator >= this.dt - EPSILON && steps < this.maxStepsPerFrame) {
      this.accumulator -= this.dt;
      steps++;
    }
    if (this.accumulator >= this.dt - EPSILON) {
      // We hit the step cap: drop the backlog instead of chasing it.
      this.accumulator %= this.dt;
    }
    this.accumulator = Math.max(this.accumulator, 0);

    return { steps, alpha: this.accumulator / this.dt };
  }

  reset() {
    this.accumulator = 0;
  }
}
