import { Action } from '../planning/Action.js';
import { WorldState } from '../planning/WorldState.js';
import { faceToward } from './coverMoves.js';

const STEP_LENGTH = 70; // how far to the side there must be room
const DURATION = 0.45;

/**
 * A gun is aimed at the agent and there is no cover to duck behind: sidestep
 * out of the line of fire, still facing the threat. Possible when there is
 * room to move to either side.
 */
export class DodgeShuffle extends Action {
  id = 'DodgeShuffle';
  cost = 2;
  barkPriority = 1;
  effects = WorldState.from({ Threatened: false });

  #lastSide = 1;

  checkProceduralPreconditions(ctx) {
    return this.#pickSide(ctx) !== 0;
  }

  activate(ctx) {
    ctx.memory.dodging = true;
    const side = this.#pickSide(ctx) || this.#lastSide;
    this.#lastSide = side;

    ctx.fsm.animate({
      duration: DURATION,
      tick: ({ agent, threat }, elapsed, dt, intent) => {
        const toward = threat ?? { x: agent.x + Math.cos(agent.aimAngle), y: agent.y + Math.sin(agent.aimAngle) };
        faceToward(agent, toward, dt, intent);
        const { dirX, dirY } = perpendicular(agent, toward);
        intent.moveX = dirX * side;
        intent.moveY = dirY * side;
      },
    });
  }

  update({ fsm }) {
    return fsm.status === 'done' ? 'done' : 'running';
  }

  deactivate({ memory, now }) {
    memory.dodging = false;
    memory.dodgedAt = now;
  }

  /** 1 or -1 for the side with room (alternating, so it does not always go the same way), or 0. */
  #pickSide({ agent, world, threat }) {
    const toward = threat ?? { x: agent.x + Math.cos(agent.aimAngle), y: agent.y + Math.sin(agent.aimAngle) };
    const { dirX, dirY } = perpendicular(agent, toward);
    for (const side of [-this.#lastSide, this.#lastSide]) {
      if (world.nav.clearLine(agent.x, agent.y, agent.x + dirX * side * STEP_LENGTH, agent.y + dirY * side * STEP_LENGTH)) {
        return side;
      }
    }
    return 0;
  }
}

/** The unit vector at right angles to the line from the agent to a point. */
function perpendicular(agent, point) {
  const dx = point.x - agent.x;
  const dy = point.y - agent.y;
  const length = Math.hypot(dx, dy) || 1;
  return { dirX: -dy / length, dirY: dx / length };
}
