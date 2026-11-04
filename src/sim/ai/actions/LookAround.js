import { Action } from '../planning/Action.js';
import { WorldState } from '../planning/WorldState.js';
import { sweepAnimation } from './looking.js';

const AMPLITUDE = (35 * Math.PI) / 180;
const AT_POST_DISTANCE = 50;

/**
 * The idle behavior: sweep the gaze left and right around the direction the
 * agent was posted facing (or around where it looks now, if it is away from its
 * post). It is a loop in effect, since the Idle goal is never satisfied and the
 * agent plans it again.
 */
export class LookAround extends Action {
  id = 'LookAround';
  cost = 1;
  effects = WorldState.from({ OnWatch: true });

  activate({ fsm, agent, home }) {
    const atPost = Math.hypot(agent.x - home.x, agent.y - home.y) <= AT_POST_DISTANCE;
    fsm.animate({
      tick: sweepAnimation({ base: atPost ? home.angle : agent.aimAngle, amplitude: AMPLITUDE, hold: 1.2 }),
    });
  }

  update({ fsm }) {
    return fsm.status === 'done' ? 'done' : 'running';
  }

  /** Only remark on it when settling down after something happened, not at spawn or on every sweep. */
  barkKeys({ previousGoalId }) {
    return previousGoalId && previousGoalId !== 'Idle' ? [this.id] : [];
  }
}
