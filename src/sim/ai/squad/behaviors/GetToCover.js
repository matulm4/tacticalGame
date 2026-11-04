import { THREAT_MEMORY } from '../../../defs/tuning.js';
import { findCover } from '../../cover/CoverQuery.js';
import { gotoCoverOrder, suppressOrder } from '../Orders.js';
import { SquadBehavior, brainOf, pickSuppressor } from './SquadBehavior.js';

/**
 * The squad is under threat and some of it is out in the open: one member
 * keeps the enemy's head down while the others run to cover (each to a
 * different position). Members already in cover stay put.
 */
export class GetToCover extends SquadBehavior {
  id = 'getToCover';
  timeout = 8;
  cooldown = { done: 3, failed: 4 }; // a pause to fight from the cover just reached

  plan(world, squad) {
    const sighting = squad.sighting(world, THREAT_MEMORY);
    if (!sighting) return null;

    const exposed = squad.members.filter((agent) => {
      const brain = brainOf(agent);
      return brain.can('MoveToCover') && !brain.inCover;
    });
    if (exposed.length === 0) return null;

    const suppressor = pickSuppressor(world, squad.members, sighting);
    if (!suppressor) return null;

    const now = world.time;
    const { reservations } = world.cover;
    const orders = [];
    for (const agent of exposed) {
      if (agent === suppressor) continue;
      const cover = findCover({ agent, world }, sighting, { isTaken: (node) => reservations.isTaken(node.id, agent.id, now) });
      if (!cover || !reservations.claim(cover.node.id, agent.id, now)) continue;
      const order = gotoCoverOrder({ behavior: this.id, squadId: squad.id, now, timeout: this.timeout, node: cover.node });
      orders.push({ agent, order, support: false });
    }
    if (orders.length === 0) return null;

    const target = { x: sighting.x, y: sighting.y };
    const cover = suppressOrder({ behavior: this.id, squadId: squad.id, now, timeout: this.timeout, target });
    return [...orders, { agent: suppressor, order: cover, support: true }];
  }

  refresh(world, squad) {
    aimSuppression(world, squad, this.issued);
  }
}

/** Point every suppress order at where the enemy was last known to be. */
export function aimSuppression(world, squad, issued) {
  const sighting = squad.blackboard.sighting;
  if (!sighting) return;
  for (const { order } of issued) {
    if (order.type === 'suppress') order.target = { x: sighting.x, y: sighting.y };
  }
}
