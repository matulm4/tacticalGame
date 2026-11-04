import { Goal } from '../planning/Goal.js';
import { WorldState } from '../planning/WorldState.js';

const COOLDOWN = 1.8; // seconds before it will dodge again

/**
 * Get out of the way when a gun is aimed at the agent, but not non-stop: after a
 * dodge ends it waits out a cooldown before dodging again. A dodge already under
 * way stays wanted until it is finished (starting one must not cancel it).
 */
export class Dodge extends Goal {
  id = 'Dodge';

  relevance({ memory, now }) {
    if (memory.dodging) return this.priority;
    return memory.isThreatened(now) && now - memory.dodgedAt > COOLDOWN ? this.priority : 0;
  }

  goalState() {
    return WorldState.from({ Threatened: false });
  }
}
