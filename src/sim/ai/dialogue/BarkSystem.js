import { BARKS } from './barks.js';

/**
 * Lets agents say their action's line as a 'bark' event (the client shows it as
 * a speech bubble). The line is chosen AFTER the decision is made, as in the
 * paper: the chatter explains what the agent is already doing.
 *
 * Cooldowns keep it from turning into noise: one agent does not speak again
 * for a moment, does not repeat the same line for a while, and the whole world
 * leaves a short gap between lines. A line with a higher priority than the
 * agent's last one (a combat callout over idle chatter) skips the agent's own
 * cooldown, so it is never drowned out by something it said a second ago, and one
 * with a higher priority than the last line anyone spoke skips the world's gap too.
 */
export class BarkSystem {
  #lastSpoke = new Map(); // agent id -> { time, text, priority }
  #lastAny = -Infinity;
  #lastAnyPriority = 0;
  #agentGap;
  #repeatGap;
  #globalGap;

  /** All gaps in simulated seconds. */
  constructor({ agentGap = 1.5, repeatGap = 8, globalGap = 0.3 } = {}) {
    this.#agentGap = agentGap;
    this.#repeatGap = repeatGap;
    this.#globalGap = globalGap;
  }

  /**
   * @param {object} world
   * @param {object} agent
   * @param {string[]} keys  line keys to try, most specific first
   * @param {number} [priority]  higher beats the agent's own cooldown after a lower one
   * @returns {boolean} whether the agent actually spoke
   */
  say(world, agent, keys, priority = 0) {
    const key = keys.find((candidate) => BARKS[candidate]);
    if (!key) return false;

    const lines = BARKS[key];
    const text = lines.length === 1 ? lines[0] : world.rng.pick(lines);
    const now = world.time;

    const last = this.#lastSpoke.get(agent.id);
    if (now - this.#lastAny < this.#globalGap && priority <= this.#lastAnyPriority) return false;
    if (last && priority <= last.priority && now - last.time < this.#agentGap) return false;
    if (last && last.text === text && now - last.time < this.#repeatGap) return false;

    this.#lastSpoke.set(agent.id, { time: now, text, priority });
    this.#lastAny = now;
    this.#lastAnyPriority = priority;
    world.emit('bark', { agentId: agent.id, text, x: agent.x, y: agent.y });
    return true;
  }
}
