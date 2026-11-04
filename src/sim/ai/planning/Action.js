import { WorldState } from './WorldState.js';

/**
 * What an agent can do, in the planner's terms: preconditions that must hold,
 * effects it has, and a cost. The planner chains actions (the effect of one
 * satisfies the precondition of the next) and picks the cheapest chain that
 * reaches a goal.
 *
 * An action is also how the plan gets executed: activate() puts the agent's
 * state machine into Goto or Animate, update() watches it and says when the
 * action is done or has failed. (This is the paper's "procedural effect".)
 *
 * Subclasses set `id`, `cost`, `preconditions` and `effects`, and override what they need.
 * Instances belong to one agent's brain, so they may keep state while running.
 *
 * `ctx` is the brain's context: { agent, world, memory, fsm, nodes, home,
 * weapon, now, dt, goal, previousGoalId }, see ai/AIBrain.js.
 */
export class Action {
  /** Unique name; also keys the chatter line. */
  id = 'Action';
  /** What the planner minimizes. Always positive. */
  cost = 1;
  /** How much its chatter line matters (see dialogue/BarkSystem.js). */
  barkPriority = 0;
  preconditions = new WorldState();
  /** Effect values may be PARAM ("whatever the goal asks for"). */
  effects = new WorldState();

  /**
   * Checks that cannot be written as world state variables (the paper's
   * "procedural preconditions"), run only while planning, e.g. "is there a
   * path?". `bindings` holds the values chosen for PARAM effects.
   */
  checkProceduralPreconditions(ctx, bindings) {
    return true;
  }

  /** Start doing it: put the state machine to work. */
  activate(ctx, bindings) {}

  /** Called every tick while running. @returns {'running' | 'done' | 'failed'} */
  update(ctx) {
    return 'running';
  }

  /** Stop doing it (finished, failed or interrupted). */
  deactivate(ctx) {}

  /** Does the world still allow this action to continue? If not, the agent re-plans. */
  isStillValid(ctx) {
    return true;
  }

  /** Chatter line keys to try, most specific first (see dialogue/barks.js). */
  barkKeys(ctx) {
    return [this.id];
  }
}
