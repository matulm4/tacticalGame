import { angleDiff, rotateToward } from '../../../core/math.js';

const ARRIVED = 0.04; // radians: close enough to the wanted direction

/**
 * An animation that sweeps the aim to `base + amplitude`, then `base - amplitude`,
 * then back to `base`, pausing `hold` seconds at each. Turns at half the
 * agent's normal turn rate, like a person scanning rather than snapping round.
 * @returns {(ctx: object, elapsed: number, dt: number, intent: object) => boolean}
 *   an AnimateState tick that returns true once the sweep is complete
 */
export function sweepAnimation({ base, amplitude, hold }) {
  const angles = [base + amplitude, base - amplitude, base];
  let phase = 0;
  let held = 0;

  return (ctx, elapsed, dt, intent) => {
    const { agent } = ctx;
    const wanted = angles[phase];
    intent.aimAngle = rotateToward(agent.aimAngle, wanted, agent.def.turnRate * 0.5 * dt);

    if (Math.abs(angleDiff(intent.aimAngle, wanted)) < ARRIVED) {
      held += dt;
      if (held >= hold) {
        held = 0;
        phase++;
        if (phase >= angles.length) return true;
      }
    }
    return false;
  };
}

/**
 * An animation that turns to face a point and keeps looking at it.
 * @returns {(ctx: object, elapsed: number, dt: number, intent: object) => boolean}
 *   true once it has looked straight at the point for `hold` seconds
 */
export function lookAtAnimation({ x, y, hold }) {
  let held = 0;

  return (ctx, elapsed, dt, intent) => {
    const { agent } = ctx;
    const wanted = Math.atan2(y - agent.y, x - agent.x);
    intent.aimAngle = rotateToward(agent.aimAngle, wanted, agent.def.turnRate * dt);
    if (Math.abs(angleDiff(intent.aimAngle, wanted)) < ARRIVED) held += dt;
    return held >= hold;
  };
}
