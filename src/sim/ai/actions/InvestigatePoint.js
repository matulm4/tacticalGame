import { Action } from '../planning/Action.js';
import { WorldState } from '../planning/WorldState.js';
import { sweepAnimation } from './looking.js';

const LOOK_AMPLITUDE = (55 * Math.PI) / 180;

/**
 * Go and see: walk to the noise or last known position (the Goto state), then
 * look around there for a moment (the Animate state), then mark it checked.
 * It can only be planned when there is a path to the spot.
 */
export class InvestigatePoint extends Action {
  id = 'InvestigatePoint';
  cost = 4;
  effects = WorldState.from({ Investigated: true });

  #point = null;
  #phase = 'goto';

  checkProceduralPreconditions({ agent, world, memory, now }) {
    const point = memory.investigationPoint(now);
    return point !== null && world.nav.findPath(agent, point) !== null;
  }

  activate({ fsm, memory, now }) {
    this.#point = memory.investigationPoint(now);
    this.#phase = 'goto';
    fsm.goto({ x: this.#point.x, y: this.#point.y, arriveRadius: 24 });
  }

  update({ fsm, agent, memory, now }) {
    if (fsm.status === 'failed') return 'failed';

    if (this.#phase === 'goto' && fsm.status === 'arrived') {
      this.#phase = 'look';
      fsm.animate({ tick: sweepAnimation({ base: agent.aimAngle, amplitude: LOOK_AMPLITUDE, hold: 0.4 }) });
    }
    if (this.#phase === 'look' && fsm.status === 'done') {
      memory.markInvestigated(now);
      return 'done';
    }
    return 'running';
  }

  barkKeys({ goal }) {
    return [`InvestigatePoint:${goal?.tag}`, this.id];
  }
}
