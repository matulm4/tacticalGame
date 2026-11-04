// Seeded pseudo-random numbers (mulberry32). The simulation never calls
// Math.random; it draws from a Rng owned by the world, so runs are reproducible.

export class Rng {
  #state;

  constructor(seed = 1) {
    this.#state = seed | 0;
  }

  /** Current internal state, enough to resume the stream (for replays). */
  get state() {
    return this.#state;
  }

  /** Uniform float in [0, 1). */
  next() {
    this.#state = (this.#state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.#state ^ (this.#state >>> 15), 1 | this.#state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min, max) {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, maxExclusive). */
  int(min, maxExclusive) {
    return min + Math.floor(this.next() * (maxExclusive - min));
  }

  pick(array) {
    return array[this.int(0, array.length)];
  }

  /** An independent stream, derived deterministically from this one and a label. */
  fork(label) {
    let hash = 2166136261;
    for (let i = 0; i < label.length; i++) {
      hash ^= label.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return new Rng(hash ^ Math.floor(this.next() * 4294967296));
  }
}
