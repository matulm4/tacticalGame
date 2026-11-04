import { rotateToward } from '../../../core/math.js';

const ARRIVED = 6; // close enough to a point to count as there

/** Walk straight toward a point (the cover moves are short, over ground already checked clear). */
export function stepToward(agent, point, intent) {
  const dx = point.x - agent.x;
  const dy = point.y - agent.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= ARRIVED) return true;
  intent.moveX = dx / distance;
  intent.moveY = dy / distance;
  return false;
}

/** Turn toward a point at the agent's turn rate. Returns the angle between where it faces and the point. */
export function faceToward(agent, point, dt, intent) {
  const wanted = Math.atan2(point.y - agent.y, point.x - agent.x);
  intent.aimAngle = rotateToward(agent.aimAngle, wanted, agent.def.turnRate * dt);
  return wanted;
}
