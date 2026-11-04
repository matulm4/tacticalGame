// An Intent is everything an agent wants to do this tick. The player's
// controller and the AI controller both produce one, so the simulation cannot
// tell them apart.
//
//   moveX, moveY  desired direction, length <= 1
//   aimAngle      radians, 0 = +x, clockwise on screen (y points down)
//   fire          trigger held
//   blind         null, or an arm-out offset { x, y } in world units added to the
//                 muzzle: zero over low cover, sideways past the edge of high cover
//   reload        start a reload
//   crouch        want to be crouched

export function emptyIntent(aimAngle = 0) {
  return { moveX: 0, moveY: 0, aimAngle, fire: false, blind: null, reload: false, crouch: false };
}

const finiteOr = (value, fallback) => (Number.isFinite(value) ? value : fallback);

/** Returns a clean copy: finite numbers, move vector clamped to unit length. */
export function sanitizeIntent(raw, fallbackAim = 0) {
  let moveX = finiteOr(raw.moveX, 0);
  let moveY = finiteOr(raw.moveY, 0);
  const length = Math.hypot(moveX, moveY);
  if (length > 1) {
    moveX /= length;
    moveY /= length;
  }
  return {
    moveX,
    moveY,
    aimAngle: finiteOr(raw.aimAngle, fallbackAim),
    fire: Boolean(raw.fire),
    blind: raw.blind ? { x: finiteOr(raw.blind.x, 0), y: finiteOr(raw.blind.y, 0) } : null,
    reload: Boolean(raw.reload),
    crouch: Boolean(raw.crouch),
  };
}
