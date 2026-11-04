import { obstacleBlocks } from '../../map/coverRules.js';

const MAX_COVER_DISTANCE = 450; // how far an agent will go to reach cover
const MIN_THREAT_DISTANCE = 80; // cover this close to the threat is no cover
const PEEK_STEPS = [24, 48, 72, 96, 120]; // how far along a wall an agent will step to see round it
const CANDIDATES_TO_PATH_CHECK = 5;
const ADVANCE_EXPOSURE_PENALTY = 300; // route score cost of a route that is entirely in the threat's view

/**
 * Is `node` real cover from a threat at (threat.x, threat.y)? An agent hiding
 * there is crouched, so the line to the threat must be stopped by the very
 * obstacle the node is behind (high cover always stops it; low cover stops it
 * because the hiding agent is crouched).
 */
export function isValidCover(world, node, threat) {
  const hit = world.static.raycast(node.x, node.y, threat.x, threat.y, (obstacle) =>
    obstacleBlocks(obstacle.height, { sourceCrouched: true }),
  );
  return hit !== null && hit.obstacle.id === node.obstacleId;
}

/** How far an agent with this archetype sees a target (a crouched one is seen from closer). */
export function sightRange(def, targetCrouched) {
  return def.vision.range * (targetCrouched ? def.vision.crouchRangeMult : 1);
}

/**
 * Where an agent at `node` can step to see (and shoot) the threat, or null.
 * Behind low cover it simply stands up. Behind high cover it steps along the
 * wall until the wall no longer blocks the view, taking the nearest such spot.
 * A spot farther from the threat than `maxRange` does not count: from there the
 * agent could not see it.
 * @returns {{ x: number, y: number, distance: number } | null} distance is how far from the node
 */
export function peekPoint(world, node, threat, threatCrouched = false, maxRange = Infinity) {
  const { static: map, nav } = world;
  const sees = (x, y) =>
    Math.hypot(threat.x - x, threat.y - y) <= maxRange &&
    !map.segmentBlocked(x, y, threat.x, threat.y, { sourceCrouched: false, targetCrouched: threatCrouched });

  if (node.height === 'low') return sees(node.x, node.y) ? { x: node.x, y: node.y, distance: 0 } : null;

  const tangentX = -node.ny;
  const tangentY = node.nx;
  for (const step of PEEK_STEPS) {
    for (const side of [1, -1]) {
      const x = node.x + tangentX * side * step;
      const y = node.y + tangentY * side * step;
      if (map.circleFits(x, y, nav.clearance) && nav.clearLine(node.x, node.y, x, y) && sees(x, y)) {
        return { x, y, distance: step };
      }
    }
  }
  return null;
}

/**
 * How much of a route lies in the threat's view, 0 to 1: the share of points
 * along it (every ~30 units) that a standing agent could be shot at from the
 * threat's position. A route round the back of a wall scores low.
 */
export function routeExposure(world, path, threat, range) {
  let seen = 0;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 30));
    for (let k = 1; k <= steps; k++) {
      const x = a.x + ((b.x - a.x) * k) / steps;
      const y = a.y + ((b.y - a.y) * k) / steps;
      total++;
      const exposed =
        Math.hypot(threat.x - x, threat.y - y) <= range &&
        !world.static.segmentBlocked(x, y, threat.x, threat.y, { sourceCrouched: false, targetCrouched: false });
      if (exposed) seen++;
    }
  }
  return total === 0 ? 0 : seen / total;
}

/**
 * The best cover to run to against a threat: close to the agent, real cover,
 * not too far from the fight, with a place to peek from. Only the best few are
 * checked for a walkable route.
 *
 * Options:
 *   isTaken(node)  skip positions someone else has claimed
 *   advance        { distance } look for cover at least `distance` closer to the threat than
 *                  the agent is, and prefer routes that stay out of the threat's view (so a
 *                  squad pushing forward goes round the walls instead of across the open)
 * @returns {{ node: object, peek: object, path: object[] } | null}
 */
export function findCover(ctx, threat, { isTaken = () => false, advance = null } = {}) {
  const { agent, world } = ctx;
  const threatCrouched = Boolean(world.getAgent(threat.id)?.crouched);
  const range = sightRange(agent.def, threatCrouched);
  const agentFromThreat = Math.hypot(agent.x - threat.x, agent.y - threat.y);
  const candidates = [];

  for (const node of world.cover.nodes) {
    const fromAgent = Math.hypot(node.x - agent.x, node.y - agent.y);
    if (fromAgent > MAX_COVER_DISTANCE) continue;
    const fromThreat = Math.hypot(node.x - threat.x, node.y - threat.y);
    // Cover from which the threat could never be seen is no use for fighting.
    if (fromThreat < MIN_THREAT_DISTANCE || fromThreat > range || !isValidCover(world, node, threat)) continue;
    if (advance && fromThreat > agentFromThreat - advance.distance) continue;
    if (isTaken(node)) continue;

    // Cover with nowhere to look out from is no use for fighting either.
    const peek = peekPoint(world, node, threat, threatCrouched, range);
    if (!peek) continue;
    const score = fromAgent + 0.25 * Math.max(0, fromThreat - 350) + peek.distance * 0.3;
    candidates.push({ node, peek, score });
  }

  candidates.sort((a, b) => a.score - b.score);
  let best = null;
  for (const candidate of candidates.slice(0, CANDIDATES_TO_PATH_CHECK)) {
    const path = world.nav.findPath(agent, candidate.node);
    if (!path) continue;
    if (!advance) return { ...candidate, path };

    const score = candidate.score + routeExposure(world, path, threat, range) * ADVANCE_EXPOSURE_PENALTY;
    if (!best || score < best.score) best = { ...candidate, score, path };
  }
  return best;
}
