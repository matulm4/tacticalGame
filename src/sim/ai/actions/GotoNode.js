import { Action } from '../planning/Action.js';
import { PARAM } from '../planning/worldStateSchema.js';
import { WorldState } from '../planning/WorldState.js';

/**
 * Walk to a node. Its effect is `AtNode = PARAM`: it can satisfy any goal that
 * wants the agent at some node, and the planner binds which node. Only
 * possible when there is a path. Arriving at a cover node settles the agent
 * into that cover.
 */
export class GotoNode extends Action {
  id = 'GotoNode';
  cost = 3;
  effects = WorldState.from({ AtNode: PARAM });

  #handle = 0;

  checkProceduralPreconditions({ agent, world, nodes }, bindings) {
    const node = nodes.get(bindings.AtNode);
    return node !== null && world.nav.findPath(agent, node) !== null;
  }

  activate({ fsm, nodes, world, agent, now }, bindings) {
    this.#handle = bindings.AtNode;
    const node = nodes.get(this.#handle);
    if (node.kind === 'cover') world.cover.reservations.claim(node.cover.id, agent.id, now);
    fsm.goto({ x: node.x, y: node.y, arriveRadius: 14 });
  }

  update({ fsm, nodes, settleInCover, world, agent, now }) {
    if (fsm.status === 'failed') return 'failed';

    const node = nodes.get(this.#handle);
    if (node.kind === 'cover') world.cover.reservations.claim(node.cover.id, agent.id, now); // still on its way
    if (fsm.status !== 'arrived') return 'running';

    if (node.kind === 'cover') settleInCover(node.cover);
    return 'done';
  }

  barkKeys({ goal }) {
    return [`GotoNode:${goal?.id}`, this.id];
  }
}
