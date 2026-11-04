const STUCK_CHECK_INTERVAL = 0.5; // seconds
const STUCK_DISTANCE = 5; // moving less than this in that time counts as stuck

/**
 * Walks an agent along a path: says which way to go each tick, moves on to the
 * next waypoint when close to the current one, and notices when the agent is
 * stuck (so the caller can find a new path).
 */
export class PathFollower {
  #path;
  #index = 1; // waypoint 0 is where the path started
  #waypointRadius;
  #arriveRadius;
  #checkedAt = null;
  #sinceCheck = 0;

  /**
   * @param {{ x: number, y: number }[]} path
   * @param {{ waypointRadius?: number, arriveRadius?: number }} [options]
   *   arriveRadius is used for the last waypoint, waypointRadius for the others
   */
  constructor(path, { waypointRadius = 12, arriveRadius = 18 } = {}) {
    this.#path = path;
    this.#waypointRadius = waypointRadius;
    this.#arriveRadius = arriveRadius;
  }

  /** The waypoints still ahead (for showing the route left to walk). */
  remaining() {
    return this.#path.slice(this.#index);
  }

  /** @returns {{ dirX: number, dirY: number, arrived: boolean, stuck: boolean }} dir is a unit vector (zero once arrived) */
  step(agent, dt) {
    const path = this.#path;
    const lastIndex = path.length - 1;

    while (this.#index <= lastIndex) {
      const radius = this.#index === lastIndex ? this.#arriveRadius : this.#waypointRadius;
      if (Math.hypot(path[this.#index].x - agent.x, path[this.#index].y - agent.y) > radius) break;
      this.#index++;
    }
    if (this.#index > lastIndex) return { dirX: 0, dirY: 0, arrived: true, stuck: false };

    const dx = path[this.#index].x - agent.x;
    const dy = path[this.#index].y - agent.y;
    const length = Math.hypot(dx, dy) || 1;

    return { dirX: dx / length, dirY: dy / length, arrived: false, stuck: this.#isStuck(agent, dt) };
  }

  #isStuck(agent, dt) {
    if (this.#checkedAt === null) this.#checkedAt = { x: agent.x, y: agent.y };
    this.#sinceCheck += dt;
    if (this.#sinceCheck < STUCK_CHECK_INTERVAL) return false;

    const moved = Math.hypot(agent.x - this.#checkedAt.x, agent.y - this.#checkedAt.y);
    this.#checkedAt = { x: agent.x, y: agent.y };
    this.#sinceCheck = 0;
    return moved < STUCK_DISTANCE;
  }
}
