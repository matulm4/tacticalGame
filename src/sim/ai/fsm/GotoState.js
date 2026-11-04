import { rotateToward } from '../../../core/math.js';
import { PathFollower } from '../nav/PathFollower.js';

const MAX_REPATHS = 2;

/**
 * The first of the paper's two states: walk to a destination. It finds a path,
 * follows it (finding a new one if the agent gets stuck), and faces the way it
 * is going. `status` becomes 'arrived' or 'failed'.
 */
export class GotoState {
  kind = 'goto';
  status = 'running';
  /** The whole path that was found. */
  path = null;

  #target;
  #arriveRadius;

  /** The waypoints still to walk (for the debug overlay), or null before a path is found. */
  get remainingPath() {
    return this.#follower?.remaining() ?? null;
  }

  #follower = null;
  #repaths = 0;

  /** @param {{ x: number, y: number, arriveRadius?: number }} params */
  constructor({ x, y, arriveRadius = 18 }) {
    this.#target = { x, y };
    this.#arriveRadius = arriveRadius;
  }

  update(ctx, dt, intent) {
    const { agent } = ctx;
    if (!this.#follower && !this.#findPath(ctx)) return;

    const step = this.#follower.step(agent, dt);
    if (step.arrived) {
      this.status = 'arrived';
      return;
    }
    if (step.stuck && (this.#repaths++ >= MAX_REPATHS || !this.#findPath(ctx))) {
      this.status = 'failed';
      return;
    }

    intent.moveX = step.dirX;
    intent.moveY = step.dirY;
    intent.aimAngle = rotateToward(agent.aimAngle, Math.atan2(step.dirY, step.dirX), agent.def.turnRate * dt);
  }

  #findPath({ agent, world }) {
    const path = world.nav.findPath(agent, this.#target);
    if (!path) {
      this.status = 'failed';
      return false;
    }
    this.path = path;
    this.#follower = new PathFollower(path, { arriveRadius: this.#arriveRadius });
    return true;
  }
}
