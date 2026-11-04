/**
 * A projectile. It remembers where it started (`originX/Y`) because low cover
 * can shield a crouched victim anywhere along the path from the muzzle, and how
 * it was fired (`shooterCrouched`, `blind`) because that decides what it flies over.
 */
export function createBullet({ id, x, y, vx, vy, ownerId, team, damage, ttl, shooterCrouched, blind }) {
  return {
    id,
    x,
    y,
    prevX: x,
    prevY: y,
    originX: x,
    originY: y,
    vx,
    vy,
    ownerId,
    team,
    damage,
    ttl,
    shooterCrouched,
    blind,
  };
}
