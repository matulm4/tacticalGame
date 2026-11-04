/**
 * A handful of same-team agents that fight together: who they are, what they
 * all know (the blackboard), and the one behavior they are carrying out.
 *
 * The blackboard holds the squad's shared picture of the enemy, so one
 * member's sighting is every member's:
 *   sighting       the freshest known sighting of a hostile: { id, x, y, time, visible }
 *                  (`visible` = somebody sees it right now), or null
 *   engagedSince   when the current contact began (a sighting after a quiet spell)
 */
export class Squad {
  /** @param {number} id @param {string} team */
  constructor(id, team) {
    this.id = id;
    this.team = team;
    /** Living members (agents). */
    this.members = [];
    this.blackboard = { sighting: null, engagedSince: -Infinity };
    /** The behavior being carried out, or null. At most one at a time. */
    this.behavior = null;
    /** No new behavior starts before this time. */
    this.cooldownUntil = 0;
    /** The sighting time the squad last searched for, so it does not search the same one twice. */
    this.searchedAt = -Infinity;
  }

  /** The shared sighting, if its target is still alive and it is no older than `maxAge` seconds. */
  sighting(world, maxAge = Infinity) {
    const sighting = this.blackboard.sighting;
    if (!sighting || !world.getAgent(sighting.id)?.alive) return null;
    return world.time - sighting.time <= maxAge ? sighting : null;
  }
}
