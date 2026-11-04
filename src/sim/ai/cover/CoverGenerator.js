import { TAU } from '../../../core/math.js';

const OFFSET = 24; // how far from an obstacle's edge an agent stands behind it
const SPACING = 40; // distance between cover positions along an obstacle
const MIN_GAP = 20; // positions closer than this are merged

/**
 * One position behind an obstacle where an agent can take cover.
 * `nx, ny` is the unit vector pointing away from the obstacle (toward where the
 * agent stands); the peek direction runs along the obstacle, perpendicular to it.
 * @typedef {{ id: string, x: number, y: number, nx: number, ny: number, obstacleId: string, height: 'high' | 'low' }} CoverNode
 */

/**
 * Cover positions around every obstacle, found once when the level is loaded.
 * (The paper uses designer-placed cover nodes; here they are derived from the
 * walls the level designer already drew.) Positions an agent could not stand
 * at, or that lie too close to another position, are dropped.
 *
 * @param {import('../../map/StaticWorld.js').StaticWorld} staticWorld
 * @param {import('../nav/NavGrid.js').NavGrid} nav  gives the clearance an agent needs
 * @returns {CoverNode[]}
 */
export function generateCover(staticWorld, nav) {
  const nodes = [];

  for (const obstacle of staticWorld.obstacles) {
    let index = 0;
    for (const { x, y, nx, ny } of candidates(obstacle.shape)) {
      if (!staticWorld.circleFits(x, y, nav.clearance)) continue;
      if (nodes.some((other) => Math.hypot(other.x - x, other.y - y) < MIN_GAP)) continue;
      nodes.push({ id: `${obstacle.id}:${index++}`, x, y, nx, ny, obstacleId: obstacle.id, height: obstacle.height });
    }
  }
  return nodes;
}

function* candidates(shape) {
  if (shape.type === 'circle') {
    const count = Math.max(6, Math.round((TAU * (shape.r + OFFSET)) / SPACING));
    for (let i = 0; i < count; i++) {
      const angle = (TAU * i) / count;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      yield { x: shape.cx + nx * (shape.r + OFFSET), y: shape.cy + ny * (shape.r + OFFSET), nx, ny };
    }
    return;
  }

  const { minX, minY, maxX, maxY } = shape.bounds;
  yield* alongSide(minX, minY, maxX, minY, 0, -1); // top side, facing up
  yield* alongSide(minX, maxY, maxX, maxY, 0, 1); // bottom
  yield* alongSide(minX, minY, minX, maxY, -1, 0); // left
  yield* alongSide(maxX, minY, maxX, maxY, 1, 0); // right
}

/** Evenly spaced positions along one side, from end to end, pushed out along the normal. */
function* alongSide(x1, y1, x2, y2, nx, ny) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.round(length / SPACING));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    yield { x: x1 + (x2 - x1) * t + nx * OFFSET, y: y1 + (y2 - y1) * t + ny * OFFSET, nx, ny };
  }
}
