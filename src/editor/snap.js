/** Rounds a value to the nearest multiple of `size`. */
export function snapValue(value, size) {
  return size > 0 ? Math.round(value / size) * size : value;
}

/** Rounds an angle to the nearest multiple of `step` radians. */
export function snapAngle(angle, step) {
  return Math.round(angle / step) * step;
}
