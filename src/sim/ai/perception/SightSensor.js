import { DEG, angleDiff } from '../../../core/math.js';
import { isHostile } from '../../defs/teams.js';

/**
 * Can `observer` see `target` right now? All of these must hold:
 *  - the target is within range (a crouched target is only seen from closer),
 *  - it is inside the observer's view cone,
 *  - nothing blocks the line between them: high walls always do; low cover
 *    does when either of them is crouched (see map/coverRules.js).
 */
export function canSee(world, observer, target) {
  const vision = observer.def.vision;
  if (!vision) return false;

  const dx = target.x - observer.x;
  const dy = target.y - observer.y;

  const range = vision.range * (target.crouched ? vision.crouchRangeMult : 1);
  if (Math.hypot(dx, dy) > range) return false;

  if (Math.abs(angleDiff(observer.aimAngle, Math.atan2(dy, dx))) > (vision.fovDeg * DEG) / 2) return false;

  return !world.static.segmentBlocked(observer.x, observer.y, target.x, target.y, {
    sourceCrouched: observer.crouched,
    targetCrouched: target.crouched,
  });
}

/** Every living hostile the observer can see. */
export function visibleHostiles(world, observer) {
  return world.agents.filter(
    (agent) =>
      agent.alive && agent !== observer && isHostile(observer.team, agent.team) && canSee(world, observer, agent),
  );
}
