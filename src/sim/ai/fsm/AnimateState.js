/**
 * The second of the paper's two states: play an "animation" in place. Here an
 * animation is a function that, each tick, fills in what the agent does (aim,
 * fire, reload, ...). It ends after `duration` seconds, or when the function
 * returns true. `status` becomes 'done'.
 */
export class AnimateState {
  kind = 'animate';
  status = 'running';
  elapsed = 0;

  #tick;
  #duration;

  /**
   * @param {object} params
   * @param {(ctx: object, elapsed: number, dt: number, intent: object) => (boolean | void)} params.tick
   * @param {number} [params.duration]  seconds; forever when omitted
   */
  constructor({ tick, duration = Infinity }) {
    this.#tick = tick;
    this.#duration = duration;
  }

  update(ctx, dt, intent) {
    if (this.status !== 'running') return;
    this.elapsed += dt;
    const finished = this.#tick(ctx, this.elapsed, dt, intent);
    if (finished || this.elapsed >= this.#duration) this.status = 'done';
  }
}
