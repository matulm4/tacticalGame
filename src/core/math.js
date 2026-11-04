// Scalar math helpers. Vector helpers take plain numbers (x, y) rather than
// objects so hot loops do not allocate.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distSq(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** Wraps an angle into (-PI, PI]. */
export function normalizeAngle(angle) {
  const wrapped = ((((angle + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/** Signed shortest rotation from `from` to `to`, in (-PI, PI]. */
export function angleDiff(from, to) {
  return normalizeAngle(to - from);
}

/** Rotates `angle` toward `target` by at most `maxStep` radians, the short way round. */
export function rotateToward(angle, target, maxStep) {
  const diff = angleDiff(angle, target);
  if (Math.abs(diff) <= maxStep) return normalizeAngle(target);
  return normalizeAngle(angle + Math.sign(diff) * maxStep);
}

/** Unit vector for (x, y); the zero vector stays zero. */
export function normalizeVector(x, y) {
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}
