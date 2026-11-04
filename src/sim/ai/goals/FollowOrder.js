import { Goal } from '../planning/Goal.js';
import { WorldState } from '../planning/WorldState.js';

/**
 * Do what the squad said: wanted while an order is pending. It outranks fighting
 * and taking cover on one's own (the squad knows better) but not dodging, since
 * a gun aimed at the agent comes first. Which action carries the order out depends
 * on the order; an agent that has no such action cannot plan it, and falls back
 * to its other goals.
 */
export class FollowOrder extends Goal {
  id = 'FollowOrder';

  relevance({ order }) {
    return order ? this.priority : 0;
  }

  goalState() {
    return WorldState.from({ OrderPending: false });
  }

  /** The squad behavior that gave the order: picks the chatter line. */
  tag({ order }) {
    return order?.behavior ?? null;
  }
}
