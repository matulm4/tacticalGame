import { DEG, angleDiff } from '../../../core/math.js';
import { isHostile } from '../../defs/teams.js';

const AIMED_RANGE = 700;
const AIMED_TOLERANCE = 6 * DEG; // a gun pointed within this of someone counts as aimed at them
const NEAR_MISS = 70; // a hostile bullet this close, heading our way, counts as fire

/**
 * Is `shooter`'s gun aimed at `me`? True when it points within a few degrees
 * (or the width of my body) of me, from within range, and nothing blocks the
 * line. Used to trigger dodging. The caller passes the shooter an agent can see:
 * an agent does not notice a gun aimed at it by someone it cannot see.
 */
export function isAimedAt(world, me, shooter) {
  if (!shooter.alive || shooter === me || !isHostile(shooter.team, me.team)) return false;

  const dx = me.x - shooter.x;
  const dy = me.y - shooter.y;
  const distance = Math.hypot(dx, dy);
  if (distance > AIMED_RANGE || distance === 0) return false;

  const tolerance = Math.max(AIMED_TOLERANCE, Math.asin(Math.min(1, (me.def.radius + 8) / distance)));
  if (Math.abs(angleDiff(shooter.aimAngle, Math.atan2(dy, dx))) > tolerance) return false;

  return !world.static.segmentBlocked(shooter.x, shooter.y, me.x, me.y, {
    sourceCrouched: shooter.crouched,
    targetCrouched: me.crouched,
  });
}

/** Is a hostile bullet whizzing past (close, and moving toward me)? Used to trigger blind fire. */
export function bulletsNearby(world, me) {
  return world.bullets.some((bullet) => {
    if (!isHostile(bullet.team, me.team)) return false;
    const dx = me.x - bullet.x;
    const dy = me.y - bullet.y;
    return Math.hypot(dx, dy) <= NEAR_MISS && bullet.vx * dx + bullet.vy * dy > 0;
  });
}
