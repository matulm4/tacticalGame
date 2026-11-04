import { FixedStepper } from '../core/FixedStepper.js';

const STATS_WINDOW_SECONDS = 0.5;

/**
 * requestAnimationFrame driver around FixedStepper.
 * Calls update(dt) at a fixed rate and render(alpha) once per frame.
 */
export class GameLoop {
  #update;
  #render;
  #stepper;
  #rafId = null;
  #lastTime = 0;
  #paused = false;
  #windowSeconds = 0;
  #windowFrames = 0;
  #windowTicks = 0;

  /** Live numbers for the debug panel. */
  stats = { fps: 0, tps: 0, ticks: 0, paused: false, timeScale: 1 };

  /**
   * @param {object} options
   * @param {(dt: number) => void} options.update  fixed-step game update
   * @param {(alpha: number) => void} options.render  per-frame draw
   * @param {number} options.tickRate
   */
  constructor({ update, render, tickRate }) {
    this.#update = update;
    this.#render = render;
    this.#stepper = new FixedStepper({ tickRate });
  }

  get dt() {
    return this.#stepper.dt;
  }

  get paused() {
    return this.#paused;
  }

  start() {
    if (this.#rafId !== null) return;
    this.#lastTime = performance.now();
    this.#rafId = requestAnimationFrame(this.#frame);
  }

  stop() {
    if (this.#rafId === null) return;
    cancelAnimationFrame(this.#rafId);
    this.#rafId = null;
  }

  setPaused(paused) {
    this.#paused = paused;
    this.stats.paused = paused;
  }

  setTimeScale(scale) {
    this.#stepper.timeScale = scale;
    this.stats.timeScale = scale;
  }

  /** Advance exactly one tick while paused (frame-step debugging). */
  stepOnce() {
    if (!this.#paused) return;
    this.#update(this.#stepper.dt);
    this.stats.ticks++;
    this.#render(1);
  }

  #frame = (now) => {
    this.#rafId = requestAnimationFrame(this.#frame);

    const frameSeconds = (now - this.#lastTime) / 1000;
    this.#lastTime = now;

    let alpha = 1;
    if (!this.#paused) {
      const result = this.#stepper.advance(frameSeconds);
      for (let i = 0; i < result.steps; i++) this.#update(this.#stepper.dt);
      this.stats.ticks += result.steps;
      this.#windowTicks += result.steps;
      alpha = result.alpha;
    }
    this.#render(alpha);

    this.#windowFrames++;
    this.#windowSeconds += Math.max(frameSeconds, 0);
    if (this.#windowSeconds >= STATS_WINDOW_SECONDS) {
      this.stats.fps = this.#windowFrames / this.#windowSeconds;
      this.stats.tps = this.#windowTicks / this.#windowSeconds;
      this.#windowSeconds = 0;
      this.#windowFrames = 0;
      this.#windowTicks = 0;
    }
  };
}
