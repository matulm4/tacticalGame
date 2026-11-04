import { Action } from '../planning/Action.js';
import { WorldState } from '../planning/WorldState.js';
import { sweepAnimation } from './looking.js';

const LOOK_AMPLITUDE = (55 * Math.PI) / 180;

/**
 * Carry out a `search` order: walk to the spot the squad assigned, look around
 * there, and report it checked. Only possible when there is a route.
 */
export class SearchPoint extends Action {
  id = 'SearchPoint';
  cost = 4;
  barkPriority = 2; // an order being given is heard over what anyone else is saying
  effects = WorldState.from({ OrderPending: false });

  #phase = 'goto';

  checkProceduralPreconditions({ agent, world, order }) {
    return order?.type === 'search' && world.nav.findPath(agent, order.point) !== null;
  }

  isStillValid({ order }) {
    return order?.type === 'search';
  }

  activate({ fsm, order }) {
    this.#phase = 'goto';
    fsm.goto({ x: order.point.x, y: order.point.y, arriveRadius: 24 });
  }

  update({ fsm, agent, memory, now }) {
    if (fsm.status === 'failed') return 'failed';

    if (this.#phase === 'goto' && fsm.status === 'arrived') {
      this.#phase = 'look';
      fsm.animate({ tick: sweepAnimation({ base: agent.aimAngle, amplitude: LOOK_AMPLITUDE, hold: 0.4 }) });
    }
    if (this.#phase === 'look' && fsm.status === 'done') {
      memory.markInvestigated(now); // nothing left to check there
      memory.completeOrder();
      return 'done';
    }
    return 'running';
  }
}
