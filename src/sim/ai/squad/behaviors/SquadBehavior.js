import { armOffset } from '../../actions/BlindFireFromCover.js';

const MAX_FIRING_RANGE = 600;

/** The GOAP brain steering an agent (null for anything else). */
export const brainOf = (agent) => agent.controller?.brain ?? null;

/**
 * Could `agent` fire at the spot `target` right now? From cover that means a
 * way to get the gun out (see armOffset); in the open, a clear line.
 */
export function canFireAt(world, agent, target) {
  const brain = brainOf(agent);
  if (!brain?.can('SuppressFire')) return false;
  if (Math.hypot(target.x - agent.x, target.y - agent.y) > MAX_FIRING_RANGE) return false;
  if (brain.inCover && brain.coverNode) return armOffset({ world, coverNode: brain.coverNode, threat: target }) !== null;
  return !world.static.segmentBlocked(agent.x, agent.y, target.x, target.y, { sourceCrouched: false, targetCrouched: false });
}

/**
 * The member best placed to keep the enemy's head down while the others move:
 * one already in cover (its fire does not cost it its safety), then one that
 * sees the enemy, then the closest.
 * @returns {object | null} an agent, or null if nobody can fire at `target`
 */
export function pickSuppressor(world, members, target) {
  let best = null;
  let bestScore = -Infinity;
  for (const agent of members) {
    if (!canFireAt(world, agent, target)) continue;
    const brain = brainOf(agent);
    const score =
      (brain.inCover ? 100 : 0) + (brain.memory.target ? 50 : 0) - Math.hypot(target.x - agent.x, target.y - agent.y) * 0.05;
    if (score > bestScore) {
      best = agent;
      bestScore = score;
    }
  }
  return best;
}

/**
 * A squad behavior (the paper's "squad behavior"): a short coordinated maneuver that
 * gives several members orders at once, watches them, and ends when they are carried
 * out (or have gone wrong). A squad runs one at a time.
 *
 * Subclasses set `id`, `timeout` and `cooldown`, and override plan(). plan() looks
 * for the members able to take part and returns the orders to give, or null if the
 * behavior does not fit the situation right now.
 */
export class SquadBehavior {
  id = 'SquadBehavior';
  /** Seconds before it is given up on (and the time its orders stay valid). */
  timeout = 8;
  /** Seconds the squad waits afterwards before starting another behavior. */
  cooldown = { done: 2, failed: 4 };

  /** @type {{ agent: object, order: object, support: boolean }[]} */
  issued = [];
  startedAt = 0;

  /**
   * What to do now: `{ agent, order, support }[]` (a `support` order, such as suppressing
   * fire, is not what the behavior waits for), or null if it does not apply.
   */
  plan(world, squad) {
    return null;
  }

  /** Try to start. @returns {boolean} whether orders were given */
  start(world, squad) {
    const assignments = this.plan(world, squad);
    if (!assignments || !assignments.some((entry) => !entry.support)) return false;

    this.startedAt = world.time;
    this.issued = assignments;
    for (const { agent, order } of assignments) brainOf(agent).memory.giveOrder(order);
    world.emit('squadBehavior', {
      phase: 'started',
      squadId: squad.id,
      behavior: this.id,
      agentIds: assignments.map((entry) => entry.agent.id),
    });
    return true;
  }

  /** Called while it runs. @returns {'running' | 'done' | 'failed'} */
  update(world, squad) {
    if (world.time - this.startedAt >= this.timeout) return 'failed';
    this.refresh(world, squad);

    const sighting = squad.blackboard.sighting;
    if (sighting && !world.getAgent(sighting.id)?.alive) return 'done'; // the enemy is dead

    const alive = this.issued.filter((entry) => entry.agent.alive);
    const waiting = alive.filter((entry) => !entry.support && this.#stillHolds(entry));
    if (waiting.length === 0) return alive.some((entry) => !entry.support) ? 'done' : 'failed';
    if (!alive.some((entry) => entry.support) && this.issued.some((entry) => entry.support)) return 'failed';
    return this.check(world, squad);
  }

  /** Keep the orders up to date (e.g. aim suppressing fire at where the enemy is now). */
  refresh(world, squad) {}

  /** Extra checks each tick. @returns {'running' | 'done' | 'failed'} */
  check(world, squad) {
    return 'running';
  }

  /** Withdraw whatever orders are still standing. */
  end(world, squad, outcome) {
    for (const { agent, order } of this.issued) {
      const memory = brainOf(agent)?.memory;
      if (memory?.order === order) memory.clearOrder();
    }
    world.emit('squadBehavior', { phase: 'ended', squadId: squad.id, behavior: this.id, outcome });
  }

  #stillHolds({ agent, order }) {
    return brainOf(agent).memory.order === order && !order.fulfilled;
  }
}
