// Outbound channel from the simulation. The sim emits plain, serializable
// event objects; the renderer, HUD and (later) audio drain or subscribe to them.
// Nothing in the sim ever reads its own events back.

export class EventQueue {
  #events = [];
  #listeners = new Set();
  #limit;

  /** @param {{ limit?: number }} [options] oldest events are dropped beyond `limit` */
  constructor({ limit = 10000 } = {}) {
    this.#limit = limit;
  }

  emit(type, payload = {}) {
    const event = { type, ...payload };
    this.#events.push(event);
    if (this.#events.length > this.#limit) {
      this.#events.splice(0, this.#events.length - this.#limit);
    }
    for (const listener of this.#listeners) listener(event);
    return event;
  }

  /** Synchronous listener; returns an unsubscribe function. */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Returns everything emitted since the last drain and clears the queue. */
  drain() {
    const events = this.#events;
    this.#events = [];
    return events;
  }

  get size() {
    return this.#events.length;
  }
}
