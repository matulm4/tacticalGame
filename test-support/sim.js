// Shared helpers for simulation tests. Lives outside test/ on purpose:
// `node --test` runs every .js file under test/, and this is not a test.
import { NEUTRAL_PLAYER_INPUT } from '../src/sim/controllers/PlayerController.js';
import { createAgent } from '../src/sim/entities/Agent.js';
import { emptyIntent } from '../src/sim/entities/Intent.js';
import { createEmptyMap } from '../src/sim/map/mapSchema.js';
import { Simulation } from '../src/sim/world/Simulation.js';

export const TICK = 1 / 60;

export const rect = (id, x, y, w, h, height = 'high') => ({ id, shape: 'rect', x, y, w, h, height });
export const circle = (id, cx, cy, r, height = 'high') => ({ id, shape: 'circle', cx, cy, r, height });

/** A map with the player at (100, 400) facing +x, in a 1000x800 arena by default. */
export function makeMap({
  obstacles = [],
  playerStart = { x: 100, y: 400, angle: 0 },
  spawns = [],
  width = 1000,
  height = 800,
} = {}) {
  return { ...createEmptyMap({ name: 'test', width, height }), obstacles, playerStart, spawns };
}

export const spawn = (id, x, y, { type = 'grunt', team = 'enemy', angle = 0 } = {}) => ({ id, type, team, x, y, angle });

export function makeSim(options = {}, seed = 1) {
  return new Simulation(makeMap(options), { seed });
}

/** A PlayerInput aiming straight along +x from the default start, plus overrides. */
export function input(overrides = {}) {
  return { ...NEUTRAL_PLAYER_INPUT, aimX: 7000, aimY: 400, ...overrides };
}

/**
 * Run `ticks` fixed ticks. `inputFor` is an object, or (tickIndex) => object,
 * of PlayerInput overrides. Returns every event emitted meanwhile.
 */
export function run(sim, ticks, inputFor = {}) {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    sim.setPlayerInput(input(typeof inputFor === 'function' ? inputFor(i) : inputFor));
    sim.step();
    events.push(...sim.drainEvents());
  }
  return events;
}

export const ofType = (events, type) => events.filter((event) => event.type === type);

/**
 * A motionless target. Hostile to the player unless `team` says otherwise.
 * Its controller only holds the requested stance (without one, the stance
 * system would stand it up).
 */
export function addDummy(sim, { x, y, team = 'enemy', hp = 1, crouched = false, def: overrides = {} }) {
  const def = {
    id: 'dummy',
    team,
    maxHp: hp,
    radius: 14,
    speed: 0,
    crouchSpeedMult: 0.5,
    crouchRadiusMult: 0.7,
    weapon: 'rifle',
    footstepNoise: { walk: 0, crouch: 0 },
    ...overrides, // e.g. { hearing: { sensitivity: 1 } }
  };
  const controller = { getIntent: (agent) => ({ ...emptyIntent(agent.aimAngle), crouch: crouched }) };
  const agent = createAgent({ id: sim.world.nextId(), def, x, y, controller });
  agent.crouched = crouched;
  return sim.world.addAgent(agent);
}

/** Removes random spread so bullets fly exactly where the agent aims. */
export function makeAccurate(agent) {
  const weapon = agent.weapons[0];
  weapon.def = { ...weapon.def, spreadDeg: 0, moveSpreadDeg: 0 };
}
