import { THREAT_MEMORY } from '../../../defs/tuning.js';
import { findCover } from '../../cover/CoverQuery.js';
import { gotoCoverOrder, suppressOrder } from '../Orders.js';
import { aimSuppression } from './GetToCover.js';
import { SquadBehavior, brainOf, pickSuppressor } from './SquadBehavior.js';

const ADVANCE_DELAY = 3; // seconds of fighting from cover before the squad pushes forward
const ADVANCE_STEP = 70; // each advancer wants cover at least this much closer to the enemy
const MIN_ADVANCE_DISTANCE = 160; // nobody advances once they are this close to the enemy

/**
 * A stand-off: everyone is in cover and the enemy is still there. One member
 * keeps firing while the others move up to cover closer to the enemy, then they
 * swap. The cover is chosen so the way to it stays out of the enemy's view where
 * it can, so with walls in between the advancers come round the side: flanking
 * that nobody asked for.
 */
export class AdvanceCover extends SquadBehavior {
  id = 'advance';
  timeout = 8;
  cooldown = { done: 2.5, failed: 4 };

  plan(world, squad) {
    const sighting = squad.sighting(world, THREAT_MEMORY);
    if (!sighting || world.time - squad.blackboard.engagedSince < ADVANCE_DELAY) return null;

    const walkers = squad.members.filter((agent) => brainOf(agent).can('MoveToCover'));
    if (walkers.some((agent) => !brainOf(agent).inCover)) return null; // GetToCover first

    const suppressor = pickSuppressor(world, squad.members, sighting);
    if (!suppressor) return null;

    const movers = walkers
      .filter((agent) => agent !== suppressor && Math.hypot(agent.x - sighting.x, agent.y - sighting.y) > MIN_ADVANCE_DISTANCE)
      .sort((a, b) => Math.hypot(b.x - sighting.x, b.y - sighting.y) - Math.hypot(a.x - sighting.x, a.y - sighting.y))
      .slice(0, Math.max(1, Math.floor(squad.members.length / 2)));

    const now = world.time;
    const { reservations } = world.cover;
    const orders = [];
    for (const agent of movers) {
      const cover = findCover(
        { agent, world },
        sighting,
        { advance: { distance: ADVANCE_STEP }, isTaken: (node) => reservations.isTaken(node.id, agent.id, now) },
      );
      if (!cover || !reservations.claim(cover.node.id, agent.id, now)) continue;
      const order = gotoCoverOrder({ behavior: this.id, squadId: squad.id, now, timeout: this.timeout, node: cover.node });
      orders.push({ agent, order, support: false });
    }
    if (orders.length === 0) return null;

    const target = { x: sighting.x, y: sighting.y };
    const fire = suppressOrder({ behavior: this.id, squadId: squad.id, now, timeout: this.timeout, target });
    return [...orders, { agent: suppressor, order: fire, support: true }];
  }

  refresh(world, squad) {
    aimSuppression(world, squad, this.issued);
  }
}
