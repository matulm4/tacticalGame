const SIGHT_MEMORY = 10; // seconds a last sighting is still worth checking out
const NOISE_MEMORY = 8; // seconds a heard noise is still worth checking out

/**
 * What an AI agent currently knows, as plain facts with timestamps. Perception
 * writes it; decisions read it (the planner's world state is built from it).
 *
 *   target        the hostile it can see right now: { id, x, y }, or null
 *   visibleSince  when it started seeing that target without a break
 *   lastKnown     the last place it saw a hostile: { id, x, y, time }
 *   noise         the last sound it heard: { kind, x, y, time, uncertainty }
 *   handledAt     the time up to which it has already checked things out
 *   order         what its squad has told it to do (see squad/Orders.js), or null
 */
export class WorkingMemory {
  target = null;
  visibleSince = null;
  lastKnown = null;
  noise = null;
  handledAt = -Infinity;
  threatenedAt = -Infinity; // when a gun was last aimed at it
  underFireAt = -Infinity; // when a hostile bullet last went past it
  dodgedAt = -Infinity; // when it last finished a dodge (so it does not dodge non-stop)
  dodging = false; // a dodge is under way
  order = null;

  /** The agent sees `target` (an agent) at time `time`. */
  see(target, time) {
    if (!this.target || this.target.id !== target.id) this.visibleSince = time;
    this.target = { id: target.id, x: target.x, y: target.y };
    this.lastKnown = { id: target.id, x: target.x, y: target.y, time };
  }

  /**
   * A squadmate saw `sighting` ({ id, x, y, time }): it counts as the last known
   * position unless this agent has seen the hostile more recently itself.
   */
  alert(sighting) {
    if (this.lastKnown && this.lastKnown.time >= sighting.time) return;
    this.lastKnown = { id: sighting.id, x: sighting.x, y: sighting.y, time: sighting.time };
  }

  /** The squad gave an order (see squad/Orders.js). It replaces any order the agent had. */
  giveOrder(order) {
    this.order = order;
  }

  /** The order still to be carried out (not done, not run out), or null. */
  activeOrder(now) {
    const { order } = this;
    return order && !order.fulfilled && now < order.expiresAt ? order : null;
  }

  /** The agent has done what the order asked. */
  completeOrder() {
    if (this.order) this.order.fulfilled = true;
  }

  clearOrder() {
    this.order = null;
  }

  /** Nothing hostile is in view any more (lastKnown keeps the last sighting). */
  loseSight() {
    this.target = null;
    this.visibleSince = null;
  }

  /** Is a gun being aimed at it right now (or a moment ago)? */
  isThreatened(now) {
    return now - this.threatenedAt < 0.6;
  }

  /** Has it been shot at in the last couple of seconds? */
  isUnderFire(now) {
    return now - this.underFireAt < 2;
  }

  /** The agent heard `sound` ({ kind, x, y, distance }) at time `time`. */
  hear(sound, time) {
    // The farther away, the less exactly it can tell where a noise came from.
    this.noise = { kind: sound.kind, x: sound.x, y: sound.y, time, uncertainty: sound.distance * 0.2 };
  }

  /**
   * The place worth going to look at, or null: the newest thing not yet
   * checked out that is not too old. `reason` is 'lostSight' (where a hostile
   * was last seen) or 'noise'.
   * @returns {{ x: number, y: number, time: number, reason: 'lostSight' | 'noise' } | null}
   */
  investigationPoint(now) {
    const candidates = [];
    if (this.lastKnown && this.lastKnown.time > this.handledAt && now - this.lastKnown.time <= SIGHT_MEMORY) {
      candidates.push({ x: this.lastKnown.x, y: this.lastKnown.y, time: this.lastKnown.time, reason: 'lostSight' });
    }
    if (this.noise && this.noise.time > this.handledAt && now - this.noise.time <= NOISE_MEMORY) {
      candidates.push({ x: this.noise.x, y: this.noise.y, time: this.noise.time, reason: 'noise' });
    }
    if (candidates.length === 0) return null;
    return candidates.reduce((newest, c) => (c.time > newest.time ? c : newest));
  }

  /** The agent has checked out everything it knew about up to `now`. */
  markInvestigated(now) {
    this.handledAt = now;
  }
}
