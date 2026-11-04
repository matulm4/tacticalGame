import { Action } from '../planning/Action.js';
import { WorldState } from '../planning/WorldState.js';
import { faceToward, stepToward } from './coverMoves.js';

const DURATION = 0.7;

/**
 * A gun is aimed at the agent while it is in cover: get all the way back
 * behind the cover (it may be peeking) and keep crouched until the danger
 * passes. The context-sensitive version of dodging: cheaper than a sidestep,
 * and only possible in cover.
 */
export class DodgeCovered extends Action {
  id = 'DodgeCovered';
  cost = 1;
  barkPriority = 1;
  preconditions = WorldState.from({ InCover: true });
  effects = WorldState.from({ Threatened: false });

  deactivate({ memory, now }) {
    memory.dodging = false;
    memory.dodgedAt = now;
  }

  activate({ fsm, memory }) {
    memory.dodging = true;
    fsm.animate({
      duration: DURATION,
      tick: ({ agent, coverNode, threat }, elapsed, dt, intent) => {
        intent.crouch = true;
        if (coverNode) stepToward(agent, coverNode, intent);
        if (threat) faceToward(agent, threat, dt, intent);
      },
    });
  }

  update({ fsm }) {
    return fsm.status === 'done' ? 'done' : 'running';
  }
}
