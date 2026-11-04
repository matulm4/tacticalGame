// 2D intersection and push-out primitives. All take plain numbers.
// Segment tests return the parameter t in [0, 1] of the FIRST contact along the
// segment A -> B (0 when A already lies inside the shape), or null for no contact.

const EPSILON = 1e-12;

/** Segment vs circle. */
export function segmentCircleHit(ax, ay, bx, by, cx, cy, radius) {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - cx;
  const fy = ay - cy;

  const c = fx * fx + fy * fy - radius * radius;
  if (c <= 0) return 0; // starts inside

  const a = dx * dx + dy * dy;
  if (a === 0) return null;

  const halfB = fx * dx + fy * dy;
  const discriminant = halfB * halfB - a * c;
  if (discriminant < 0) return null;

  const t = (-halfB - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}

/** Segment vs axis-aligned rectangle (slab method). */
export function segmentRectHit(ax, ay, bx, by, minX, minY, maxX, maxY) {
  let tMin = 0;
  let tMax = 1;

  const dx = bx - ax;
  if (Math.abs(dx) < EPSILON) {
    if (ax < minX || ax > maxX) return null;
  } else {
    let t1 = (minX - ax) / dx;
    let t2 = (maxX - ax) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  const dy = by - ay;
  if (Math.abs(dy) < EPSILON) {
    if (ay < minY || ay > maxY) return null;
  } else {
    let t1 = (minY - ay) / dy;
    let t2 = (maxY - ay) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  return tMin;
}

/**
 * For a segment that starts inside a rectangle: the t at which it leaves,
 * or null when B is still inside.
 */
export function segmentExitRect(ax, ay, bx, by, minX, minY, maxX, maxY) {
  if (bx >= minX && bx <= maxX && by >= minY && by <= maxY) return null;

  const dx = bx - ax;
  const dy = by - ay;
  let t = 1;
  if (dx > 0) t = Math.min(t, (maxX - ax) / dx);
  else if (dx < 0) t = Math.min(t, (minX - ax) / dx);
  if (dy > 0) t = Math.min(t, (maxY - ay) / dy);
  else if (dy < 0) t = Math.min(t, (minY - ay) / dy);
  return Math.max(t, 0);
}

/**
 * Minimal displacement that moves a circle out of an axis-aligned rectangle,
 * or null when they do not overlap (touching counts as not overlapping).
 */
export function circleRectPush(cx, cy, radius, minX, minY, maxX, maxY) {
  const nearestX = Math.min(Math.max(cx, minX), maxX);
  const nearestY = Math.min(Math.max(cy, minY), maxY);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  const distanceSq = dx * dx + dy * dy;

  if (distanceSq > 0) {
    if (distanceSq >= radius * radius) return null;
    const distance = Math.sqrt(distanceSq);
    const push = radius - distance;
    return { x: (dx / distance) * push, y: (dy / distance) * push };
  }

  // Center is inside the rectangle: leave through the nearest side.
  const toLeft = cx - minX;
  const toRight = maxX - cx;
  const toTop = cy - minY;
  const toBottom = maxY - cy;
  const smallest = Math.min(toLeft, toRight, toTop, toBottom);
  if (smallest === toLeft) return { x: -(toLeft + radius), y: 0 };
  if (smallest === toRight) return { x: toRight + radius, y: 0 };
  if (smallest === toTop) return { x: 0, y: -(toTop + radius) };
  return { x: 0, y: toBottom + radius };
}

/**
 * Displacement for circle 1 that separates it from circle 2,
 * or null when they do not overlap.
 */
export function circleCirclePush(cx, cy, radius, ox, oy, otherRadius) {
  const dx = cx - ox;
  const dy = cy - oy;
  const reach = radius + otherRadius;
  const distanceSq = dx * dx + dy * dy;
  if (distanceSq >= reach * reach) return null;
  if (distanceSq === 0) return { x: reach, y: 0 };
  const distance = Math.sqrt(distanceSq);
  const push = reach - distance;
  return { x: (dx / distance) * push, y: (dy / distance) * push };
}
