import { Action } from '../planning/Action.js';
import { WorldState } from '../planning/WorldState.js';
import { lookAtAnimation } from './looking.js';

/**
 * Investigate without moving: turn toward the noise or last known position and
 * watch it for a moment. The only way an agent that cannot walk (a sentry) can
 * satisfy the Investigate goal, so it costs more than walking there.
 */
export class LookAtNoise extends Action {
  id = 'LookAtNoise';
  cost = 6;
  effects = WorldState.from({ Investigated: true });

  checkProceduralPreconditions({ memory, now }) {
    return memory.investigationPoint(now) !== null;
  }

  activate({ fsm, memory, now }) {
    const point = memory.investigationPoint(now);
    fsm.animate({ tick: lookAtAnimation({ x: point.x, y: point.y, hold: 1.2 }) });
  }

  update({ fsm, memory, now }) {
    if (fsm.status !== 'done') return 'running';
    memory.markInvestigated(now);
    return 'done';
  }
}
