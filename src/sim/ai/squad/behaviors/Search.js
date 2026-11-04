import { THREAT_MEMORY } from '../../../defs/tuning.js';
import { searchOrder } from '../Orders.js';
import { SquadBehavior, brainOf } from './SquadBehavior.js';

const SEARCH_WINDOW = 16; // seconds after the last sighting that a search is still worth starting
const RING_RADIUS = 150; // the flanking pairs search this far round the last known position
const PAIR_OFFSET = 40; // the second member of a pair looks a little to the side of the first
const RING_TURNS = [0, 1, -1, 2, -2, 3, -3, 4].map((step) => (step * Math.PI) / 4); // tried in this order round the ring

/**
 * The enemy has been lost: the squad splits into pairs and sweeps toward where
 * it was last seen, each pair coming at it from a different side, then looks
 * around there. It ends the moment anyone sees the enemy again.
 */
export class Search extends SquadBehavior {
  id = 'search';
  timeout = 25;
  cooldown = { done: 3, failed: 5 };

  plan(world, squad) {
    const sighting = squad.sighting(world, SEARCH_WINDOW);
    if (!sighting || world.time - sighting.time <= THREAT_MEMORY || sighting.time <= squad.searchedAt) return null;
    if (squad.members.some((agent) => brainOf(agent).memory.target)) return null;

    const walkers = squad.members.filter((agent) => brainOf(agent).can('SearchPoint'));
    if (walkers.length < 2) return null;

    squad.searchedAt = sighting.time;
    const groups = pairUp(walkers).sort((a, b) => distanceToGroup(a, sighting) - distanceToGroup(b, sighting));
    const points = searchPoints(world, sighting, groups);

    const now = world.time;
    const assignments = [];
    groups.forEach((group, index) => {
      group.forEach((agent, member) => {
        const point = member === 0 ? points[index] : offsetPoint(world, points[index], member);
        const order = searchOrder({ behavior: this.id, squadId: squad.id, now, timeout: this.timeout, point });
        assignments.push({ agent, order, support: false });
      });
    });
    return assignments;
  }

  check(world, squad) {
    // Somebody has found the enemy: the fight is on, and the normal goals take over.
    return squad.members.some((agent) => brainOf(agent).memory.target) ? 'done' : 'running';
  }
}

/** Split into pairs of neighbors (a leftover member makes a group of one). */
function pairUp(agents) {
  const free = [...agents].sort((a, b) => a.id - b.id);
  const groups = [];
  while (free.length > 0) {
    const first = free.shift();
    if (free.length === 0) {
      groups.push([first]);
      break;
    }
    let nearest = 0;
    free.forEach((agent, i) => {
      if (dist(agent, first) < dist(free[nearest], first)) nearest = i;
    });
    groups.push([first, free.splice(nearest, 1)[0]]);
  }
  return groups;
}

/**
 * One spot per group: the nearest group goes straight to the last known position;
 * the next goes to a spot on a ring round it on the far side (so the two close in
 * from opposite directions), and any further group to a spot at right angles. A spot
 * that does not fit or cannot be reached is replaced by the next one round the ring.
 */
function searchPoints(world, sighting, groups) {
  const clearance = world.nav.clearance;
  const leader = groups[0][0];
  const approach = Math.atan2(sighting.y - leader.y, sighting.x - leader.x);

  const chosen = [{ x: sighting.x, y: sighting.y }];
  for (let g = 1; g < groups.length; g++) {
    const preferred = approach + (g === 1 ? 0 : g % 2 === 0 ? 1 : -1) * (Math.PI / 2);
    let point = chosen[0];
    for (const turn of RING_TURNS) {
      const angle = preferred + turn;
      const candidate = { x: sighting.x + Math.cos(angle) * RING_RADIUS, y: sighting.y + Math.sin(angle) * RING_RADIUS };
      if (world.static.circleFits(candidate.x, candidate.y, clearance) && world.nav.findPath(groups[g][0], candidate)) {
        point = candidate;
        break;
      }
    }
    chosen.push(point);
  }
  return chosen;
}

/** A spot beside `point`, for the second member of a pair (or `point` itself if there is no room). */
function offsetPoint(world, point, member) {
  const shifted = { x: point.x + PAIR_OFFSET * member, y: point.y };
  return world.static.circleFits(shifted.x, shifted.y, world.nav.clearance) ? shifted : point;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const distanceToGroup = (group, point) => Math.min(...group.map((agent) => dist(agent, point)));
