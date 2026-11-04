import { SQUAD_LINK_DISTANCE, SQUAD_MAX_SIZE, SQUAD_RATE, SQUAD_RECLUSTER } from '../../defs/tuning.js';
import { Squad } from './Squad.js';
import { AdvanceCover } from './behaviors/AdvanceCover.js';
import { GetToCover } from './behaviors/GetToCover.js';
import { Search } from './behaviors/Search.js';
import { brainOf } from './behaviors/SquadBehavior.js';

// Tried in this order each time a squad is free: first get everyone covered, then push
// forward from a stand-off, and when the enemy is lost, search. Only the first that fits starts.
const BEHAVIORS = [GetToCover, AdvanceCover, Search];

const NEW_CONTACT_GAP = 8; // a sighting this long after the previous one starts a new engagement

/**
 * Keeps the squads, as in the paper: agents close to each other are grouped
 * into squads (re-grouped every so often), and each squad then shares what its
 * members see and runs one behavior at a time.
 *
 * A squad that is busy with a behavior keeps its members until it is done.
 */
export class SquadCoordinator {
  /** @type {Squad[]} */
  squads = [];
  #nextId = 1;
  #nextThink = 0;
  #nextRecluster = 0;

  update(world) {
    if (world.time < this.#nextThink) return;
    this.#nextThink = world.time + 1 / SQUAD_RATE;

    this.#removeTheDead(world);
    if (world.time >= this.#nextRecluster) {
      this.#nextRecluster = world.time + SQUAD_RECLUSTER;
      this.#recluster(world);
    }
    for (const squad of this.squads) this.#think(world, squad);
  }

  #removeTheDead(world) {
    for (const squad of this.squads) squad.members = squad.members.filter((agent) => agent.alive);
    const empty = this.squads.filter((squad) => squad.members.length === 0);
    for (const squad of empty) squad.behavior?.end(world, squad, 'failed');
    this.squads = this.squads.filter((squad) => squad.members.length > 0);
  }

  /** Group the agents that are not in the middle of a behavior, reusing squads that still match. */
  #recluster(world) {
    const busy = this.squads.filter((squad) => squad.behavior);
    const taken = new Set(busy.flatMap((squad) => squad.members.map((agent) => agent.id)));
    const free = world.agents.filter((agent) => agent.alive && brainOf(agent) && !taken.has(agent.id));

    const idle = this.squads.filter((squad) => !squad.behavior);
    const next = [];
    for (const cluster of clusterAgents(free)) {
      const squad = takeBestMatch(idle, cluster) ?? new Squad(this.#nextId++, cluster[0].team);
      squad.members = cluster;
      next.push(squad);
    }
    this.squads = [...busy, ...next];
  }

  #think(world, squad) {
    this.#share(world, squad);

    if (squad.behavior) {
      const status = squad.behavior.update(world, squad);
      if (status !== 'running') this.#finish(world, squad, status);
      return;
    }
    if (world.time < squad.cooldownUntil || squad.members.length < 2) return;

    for (const Behavior of BEHAVIORS) {
      const behavior = new Behavior();
      if (behavior.start(world, squad)) {
        squad.behavior = behavior;
        return;
      }
    }
  }

  #finish(world, squad, outcome) {
    const { behavior } = squad;
    behavior.end(world, squad, outcome);
    squad.behavior = null;
    squad.cooldownUntil = world.time + behavior.cooldown[outcome];
  }

  /** The newest sighting of any member becomes the squad's, and every member is told of it. */
  #share(world, squad) {
    const previous = squad.blackboard.sighting;
    let best = previous;
    for (const agent of squad.members) {
      const { target, lastKnown } = brainOf(agent).memory;
      if (!lastKnown || (best && lastKnown.time < best.time)) continue;
      if (best && lastKnown.time === best.time && best.visible) continue;
      best = { id: lastKnown.id, x: lastKnown.x, y: lastKnown.y, time: lastKnown.time, visible: target !== null };
    }
    if (best && !world.getAgent(best.id)?.alive) best = null;

    if (best) best = { ...best, visible: squad.members.some((agent) => brainOf(agent).memory.target?.id === best.id) };

    squad.blackboard.sighting = best;
    if (!best) return;
    if (!previous || best.time - previous.time > NEW_CONTACT_GAP) squad.blackboard.engagedSince = best.time;
    for (const agent of squad.members) brainOf(agent).memory.alert(best);
  }
}

/** Single-linkage groups of same-team agents within link distance, split to the squad size limit. */
function clusterAgents(agents) {
  const parent = new Map(agents.map((agent) => [agent, agent]));
  const find = (agent) => {
    while (parent.get(agent) !== agent) agent = parent.get(agent);
    return agent;
  };
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i];
      const b = agents[j];
      if (a.team === b.team && Math.hypot(a.x - b.x, a.y - b.y) <= SQUAD_LINK_DISTANCE) parent.set(find(a), find(b));
    }
  }

  const groups = new Map();
  for (const agent of agents) {
    const root = find(agent);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(agent);
  }
  return [...groups.values()].flatMap(splitToSize).sort((a, b) => a[0].id - b[0].id);
}

/** Over-large groups are cut into squads of at most SQUAD_MAX_SIZE, each built round its lowest id. */
function splitToSize(group) {
  const rest = [...group].sort((a, b) => a.id - b.id);
  const squads = [];
  while (rest.length > 0) {
    const seed = rest.shift();
    rest.sort((a, b) => Math.hypot(a.x - seed.x, a.y - seed.y) - Math.hypot(b.x - seed.x, b.y - seed.y) || a.id - b.id);
    squads.push([seed, ...rest.splice(0, SQUAD_MAX_SIZE - 1)].sort((a, b) => a.id - b.id));
  }
  return squads;
}

/** Remove from `squads` and return the one sharing the most members with `cluster` (the lowest id on a tie). */
function takeBestMatch(squads, cluster) {
  let best = null;
  let bestShared = 0;
  for (const squad of squads) {
    const shared = squad.members.filter((agent) => cluster.includes(agent)).length;
    if (shared > bestShared) {
      best = squad;
      bestShared = shared;
    }
  }
  if (best) squads.splice(squads.indexOf(best), 1);
  return best;
}
