/**
 * Something an agent wants. Goals compete by relevance; the agent plans for the
 * most relevant one, and falls back to the next if no plan can reach it (an
 * agent whose action set cannot walk simply cannot plan a goal that needs
 * walking). A goal says WHAT is wanted, never how: that is the planner's job.
 *
 * Subclasses set `id` and override relevance() and goalState().
 */
export class Goal {
  id = 'Goal';

  /** @param {{ priority: number }} options  the relevance this goal has when it applies */
  constructor({ priority }) {
    this.priority = priority;
  }

  /** How badly the agent wants this right now; 0 means it does not apply. */
  relevance(ctx) {
    return 0;
  }

  /** The partial world state that satisfies the goal. */
  goalState(ctx) {
    throw new Error(`${this.id} does not define a goal state`);
  }

  /** Optional label for why the goal is active (selects a chatter line). */
  tag(ctx) {
    return null;
  }
}
