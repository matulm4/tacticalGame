import { Action } from '../planning/Action.js';
import { WorldState } from '../planning/WorldState.js';

/**
 * Carry out a `goto-cover` order: run to the cover position the squad picked
 * and settle into it. Only possible when there is a route.
 */
export class MoveToCover extends Action {
  id = 'MoveToCover';
  cost = 3;
  barkPriority = 2; // an order being given is heard over what anyone else is saying
  effects = WorldState.from({ OrderPending: false });

  checkProceduralPreconditions({ agent, world, order }) {
    return order?.type === 'goto-cover' && world.nav.findPath(agent, order.node) !== null;
  }

  isStillValid({ order }) {
    return order?.type === 'goto-cover';
  }

  activate({ fsm, order, world, agent, now }) {
    world.cover.reservations.claim(order.node.id, agent.id, now);
    fsm.goto({ x: order.node.x, y: order.node.y, arriveRadius: 14 });
  }

  update({ fsm, order, memory, settleInCover, world, agent, now }) {
    if (fsm.status === 'failed') return 'failed';
    world.cover.reservations.claim(order.node.id, agent.id, now);
    if (fsm.status !== 'arrived') return 'running';

    settleInCover(order.node);
    memory.completeOrder();
    return 'done';
  }

  barkKeys({ goal }) {
    return [`MoveToCover:${goal?.tag}`, this.id];
  }
}
