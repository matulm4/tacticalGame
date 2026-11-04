import { WEAPONS } from '../defs/weapons.js';
import { emptyIntent } from './Intent.js';

/** Runtime state of one weapon an agent carries. */
export function createWeaponState(def) {
  return { defId: def.id, def, ammo: def.magSize, cooldown: 0, reloadLeft: 0, triggerHeld: false };
}

/**
 * Plain-data agent (player or enemy). Position is kept twice (prev and current)
 * so the renderer can interpolate between ticks.
 *
 * @param {object} options
 * @param {number} options.id
 * @param {object} options.def         an entry of AGENT_TYPES (or a test double)
 * @param {object | null} [options.controller]  anything with getIntent(agent, world, dt)
 */
export function createAgent({ id, def, x, y, angle = 0, controller = null }) {
  return {
    id,
    typeId: def.id,
    def,
    team: def.team,
    x,
    y,
    prevX: x,
    prevY: y,
    aimAngle: angle,
    crouched: false,
    hp: def.maxHp,
    maxHp: def.maxHp,
    alive: true,
    speed: 0, // measured speed this tick (units per second)
    stepDistance: 0, // distance walked since the last footstep sound
    heardSounds: [], // sounds that reached this agent this tick (filled by the sound system)
    weapons: [createWeaponState(WEAPONS[def.weapon])],
    activeWeapon: 0,
    controller,
    intent: emptyIntent(angle),
  };
}

/** Current body radius: smaller while crouched. */
export function agentRadius(agent) {
  return agent.def.radius * (agent.crouched ? agent.def.crouchRadiusMult : 1);
}

export function activeWeaponOf(agent) {
  return agent.weapons[agent.activeWeapon] ?? null;
}
