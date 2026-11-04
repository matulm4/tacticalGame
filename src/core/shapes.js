// Obstacle shapes behind one small interface, so the rest of the code never
// cares which concrete shape it is looking at. Adding rotated rectangles or
// polygons later means adding one class here (plus a map-schema entry).
//
// Interface:
//   type                          'rect' | 'circle'
//   bounds                        { minX, minY, maxX, maxY }
//   containsPoint(x, y)           boolean
//   raycast(ax, ay, bx, by)       t in [0, 1] of the first hit along A -> B, or null
//   pushOutCircle(cx, cy, r)      displacement that frees a circle, or null
//   intersectsCircle(cx, cy, r)   boolean (touching is not intersecting)

import {
  circleCirclePush,
  circleRectPush,
  segmentCircleHit,
  segmentRectHit,
} from './geometry.js';

export class RectShape {
  type = 'rect';

  constructor({ x, y, w, h }) {
    this.minX = x;
    this.minY = y;
    this.maxX = x + w;
    this.maxY = y + h;
  }

  get bounds() {
    return { minX: this.minX, minY: this.minY, maxX: this.maxX, maxY: this.maxY };
  }

  containsPoint(x, y) {
    return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY;
  }

  raycast(ax, ay, bx, by) {
    return segmentRectHit(ax, ay, bx, by, this.minX, this.minY, this.maxX, this.maxY);
  }

  pushOutCircle(cx, cy, radius) {
    return circleRectPush(cx, cy, radius, this.minX, this.minY, this.maxX, this.maxY);
  }

  intersectsCircle(cx, cy, radius) {
    return this.pushOutCircle(cx, cy, radius) !== null;
  }
}

export class CircleShape {
  type = 'circle';

  constructor({ cx, cy, r }) {
    this.cx = cx;
    this.cy = cy;
    this.r = r;
  }

  get bounds() {
    return {
      minX: this.cx - this.r,
      minY: this.cy - this.r,
      maxX: this.cx + this.r,
      maxY: this.cy + this.r,
    };
  }

  containsPoint(x, y) {
    const dx = x - this.cx;
    const dy = y - this.cy;
    return dx * dx + dy * dy <= this.r * this.r;
  }

  raycast(ax, ay, bx, by) {
    return segmentCircleHit(ax, ay, bx, by, this.cx, this.cy, this.r);
  }

  pushOutCircle(cx, cy, radius) {
    return circleCirclePush(cx, cy, radius, this.cx, this.cy, this.r);
  }

  intersectsCircle(cx, cy, radius) {
    return this.pushOutCircle(cx, cy, radius) !== null;
  }
}

/** Builds a shape from a map obstacle definition ({ shape: 'rect' | 'circle', ... }). */
export function createShape(definition) {
  switch (definition.shape) {
    case 'rect':
      return new RectShape(definition);
    case 'circle':
      return new CircleShape(definition);
    default:
      throw new Error(`Unknown shape "${definition.shape}"`);
  }
}
