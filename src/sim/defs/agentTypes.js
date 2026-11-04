// Agent archetypes (data only). A new enemy type is a new entry here, reusing
// goals and actions: characters with the same goals but different action sets
// behave differently (that is the point of the F.E.A.R. design).
//
//   maxHp                hit points; every bullet does its weapon's damage
//   radius               body radius when standing (world units)
//   speed                walking speed, units per second
//   crouchSpeedMult      speed multiplier while crouched
//   crouchRadiusMult     body radius multiplier while crouched (harder to hit)
//   footstepNoise        how far footsteps are heard, walking vs crouched
//
// AI agents (enemies) also have:
//   ai                   which controller drives them (see controllers/index.js)
//   goalSet, actionSet   what they want and what they can do (see ai/data/)
//   vision               fovDeg: width of the view cone; range: how far a standing target
//                        is seen; crouchRangeMult: crouched targets are only seen this
//                        fraction of the way
//   hearing              sensitivity: multiplies how far sounds carry to this agent
//   reactionTime         seconds between first seeing a target and opening fire
//   turnRate             radians per second the agent can turn

const soldier = {
  team: 'enemy',
  maxHp: 1,
  radius: 18,
  speed: 170,
  crouchSpeedMult: 0.5,
  crouchRadiusMult: 0.7,
  weapon: 'rifle',
  footstepNoise: Object.freeze({ walk: 140, crouch: 60 }),
  ai: 'goap',
  goalSet: 'soldier',
  vision: Object.freeze({ fovDeg: 110, range: 450, crouchRangeMult: 0.5 }),
  hearing: Object.freeze({ sensitivity: 1 }),
  reactionTime: 0.45,
  turnRate: 4,
};

export const AGENT_TYPES = Object.freeze({
  player: Object.freeze({
    id: 'player',
    team: 'player',
    maxHp: 3,
    radius: 18,
    speed: 190,
    crouchSpeedMult: 0.5,
    crouchRadiusMult: 0.7,
    weapon: 'rifle',
    footstepNoise: Object.freeze({ walk: 140, crouch: 60 }),
  }),

  // Standard enemy soldier: investigates what it hears, hunts what it loses sight of, one hit kills.
  grunt: Object.freeze({ ...soldier, id: 'grunt', actionSet: 'soldier' }),

  // A guard that never leaves its post: same goals as the grunt, but no way to walk.
  sentry: Object.freeze({ ...soldier, id: 'sentry', actionSet: 'stationary' }),
});
