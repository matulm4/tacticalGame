// Weapon definitions (data only). Handgun and shotgun are new entries here:
// `pellets` and `auto` already cover them.
//
//   fireRate         rounds per second
//   reloadTime       seconds; ammo is unlimited, only the magazine is limited
//   spreadDeg        half-angle of the random cone when standing still
//   moveSpreadDeg    extra half-angle at full walking speed
//   crouchSpreadMult spread multiplier while crouched
//   blindSpreadMult  spread multiplier for blind fire
//   bulletSpeed      world units per second
//   range            world units before a bullet expires
//   muzzleLength     distance from the agent's center to the muzzle
//   noiseRadius      how far a shot is heard (world units)

export const WEAPONS = Object.freeze({
  rifle: Object.freeze({
    id: 'rifle',
    name: 'Rifle',
    damage: 1,
    magSize: 30,
    fireRate: 10,
    reloadTime: 1.8,
    auto: true,
    pellets: 1,
    spreadDeg: 2,
    moveSpreadDeg: 3,
    crouchSpreadMult: 1,
    blindSpreadMult: 4,
    bulletSpeed: 900,
    range: 1200,
    muzzleLength: 28,
    noiseRadius: 600,
  }),
});
