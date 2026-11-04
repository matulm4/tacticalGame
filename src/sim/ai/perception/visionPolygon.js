import { DEG } from '../../../core/math.js';
import { obstacleBlocks } from '../../map/coverRules.js';

/**
 * The area an agent can see, as a fan of rays across its view cone, each
 * stopping at the first obstacle that blocks it. Uses the same cover rule as
 * the sight sensor, for a standing target: a standing observer sees over low
 * cover, a crouched one does not.
 *
 * Only for showing the cone (debug overlay); the sight sensor tests agents directly.
 * @returns {{ x: number, y: number }[]} the outline, from the left edge of the cone to the right
 */
export function visionPolygon(world, observer, { rays = 48 } = {}) {
  const { fovDeg, range } = observer.def.vision;
  const half = (fovDeg * DEG) / 2;
  const points = [];

  for (let i = 0; i <= rays; i++) {
    const angle = observer.aimAngle - half + (2 * half * i) / rays;
    const endX = observer.x + Math.cos(angle) * range;
    const endY = observer.y + Math.sin(angle) * range;

    const hit = world.static.raycast(observer.x, observer.y, endX, endY, (obstacle) =>
      obstacleBlocks(obstacle.height, { sourceCrouched: observer.crouched }),
    );
    const t = hit ? hit.t : 1;
    points.push({ x: observer.x + (endX - observer.x) * t, y: observer.y + (endY - observer.y) * t });
  }
  return points;
}
