// Geometry math for moving and resizing items, shared by the select tool and
// keyboard nudging. Results are snapped (via the `snap` function passed in)
// and kept inside the map.

import { clamp } from '../core/math.js';
import { MIN_CIRCLE_RADIUS, MIN_RECT_SIZE } from './limits.js';

/** Snapshot of the numbers that define an item's position and shape. */
export function geometryOf({ kind, data }) {
  if (kind === 'obstacle') {
    return data.shape === 'rect'
      ? { x: data.x, y: data.y, w: data.w, h: data.h }
      : { cx: data.cx, cy: data.cy, r: data.r };
  }
  return { x: data.x, y: data.y, angle: data.angle };
}

export function sameGeometry(a, b) {
  return Object.keys(a).every((key) => a[key] === b[key]);
}

/** `origin` geometry moved by (dx, dy). */
export function movedGeometry(item, origin, dx, dy, map, snap) {
  if (item.kind === 'obstacle' && item.data.shape === 'rect') {
    return {
      ...origin,
      x: clamp(snap(origin.x + dx), 0, Math.max(map.width - origin.w, 0)),
      y: clamp(snap(origin.y + dy), 0, Math.max(map.height - origin.h, 0)),
    };
  }
  if (item.kind === 'obstacle') {
    return {
      ...origin,
      cx: clamp(snap(origin.cx + dx), 0, map.width),
      cy: clamp(snap(origin.cy + dy), 0, map.height),
    };
  }
  return {
    ...origin,
    x: clamp(snap(origin.x + dx), 0, map.width),
    y: clamp(snap(origin.y + dy), 0, map.height),
  };
}

/** Rectangle after dragging `handle` ('nw', 'e', ...) to `point`; the opposite edges stay put. */
export function resizedRect(origin, handle, point, map, snap) {
  let left = origin.x;
  let top = origin.y;
  let right = origin.x + origin.w;
  let bottom = origin.y + origin.h;
  const px = clamp(snap(point.x), 0, map.width);
  const py = clamp(snap(point.y), 0, map.height);

  if (handle.includes('w')) left = Math.min(px, right - MIN_RECT_SIZE);
  if (handle.includes('e')) right = Math.max(px, left + MIN_RECT_SIZE);
  if (handle.includes('n')) top = Math.min(py, bottom - MIN_RECT_SIZE);
  if (handle.includes('s')) bottom = Math.max(py, top + MIN_RECT_SIZE);

  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Circle after dragging its radius handle to `point`. */
export function resizedCircle(origin, point, snap) {
  const distance = Math.hypot(point.x - origin.cx, point.y - origin.cy);
  return { ...origin, r: Math.max(snap(distance), MIN_CIRCLE_RADIUS) };
}
