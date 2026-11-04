import { createShape } from '../../core/shapes.js';
import { obstacleBlocks } from './coverRules.js';

const FIT_TOLERANCE = 1e-6;

/**
 * Immutable level geometry built from a validated map: obstacle shapes and the
 * spatial queries the systems need. Linear scans for now; the interface hides
 * that, so a spatial grid can be dropped in later.
 */
export class StaticWorld {
  constructor(map) {
    this.width = map.width;
    this.height = map.height;
    this.obstacles = map.obstacles.map((definition) => ({
      id: definition.id,
      height: definition.height,
      shape: createShape(definition),
    }));
  }

  /**
   * First obstacle hit along A -> B among those the predicate accepts.
   * @param {(obstacle: object) => boolean} [predicate]  accept all when omitted
   * @returns {{ t: number, x: number, y: number, obstacle: object } | null}
   */
  raycast(ax, ay, bx, by, predicate = null) {
    let best = null;
    for (const obstacle of this.obstacles) {
      if (predicate && !predicate(obstacle)) continue;
      const t = obstacle.shape.raycast(ax, ay, bx, by);
      if (t !== null && (best === null || t < best.t)) best = { t, obstacle };
    }
    if (best === null) return null;
    return { t: best.t, x: ax + (bx - ax) * best.t, y: ay + (by - ay) * best.t, obstacle: best.obstacle };
  }

  /**
   * Does anything block the line from A to B (sight, or a bullet's path)?
   * Heights follow map/coverRules.js, given who is crouched at each end.
   */
  segmentBlocked(ax, ay, bx, by, ends = {}) {
    return this.raycast(ax, ay, bx, by, (obstacle) => obstacleBlocks(obstacle.height, ends)) !== null;
  }

  /** Every obstacle the line from A to B passes through (used to muffle sounds). */
  crossedObstacles(ax, ay, bx, by) {
    return this.obstacles.filter((obstacle) => obstacle.shape.raycast(ax, ay, bx, by) !== null);
  }

  /**
   * Moves a circle out of every obstacle and back inside the map. Used after a
   * tentative move, which makes agents slide along walls.
   */
  resolveCircle(x, y, radius) {
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (const obstacle of this.obstacles) {
        const push = obstacle.shape.pushOutCircle(x, y, radius);
        if (push) {
          x += push.x;
          y += push.y;
          moved = true;
        }
      }
      x = Math.min(Math.max(x, radius), this.width - radius);
      y = Math.min(Math.max(y, radius), this.height - radius);
      if (!moved) break;
    }
    return { x, y };
  }

  /**
   * True when a circle lies inside the map and overlaps no obstacle. Touching
   * counts as fitting, with a small tolerance so a circle that resolveCircle
   * just placed flush against a wall still fits despite float rounding.
   */
  circleFits(x, y, radius) {
    const r = radius - FIT_TOLERANCE;
    if (x < r || y < r || x > this.width - r || y > this.height - r) return false;
    return !this.obstacles.some((obstacle) => obstacle.shape.intersectsCircle(x, y, r));
  }
}
