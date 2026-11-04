import { DEG, angleDiff, rotateToward } from '../../../core/math.js';
import { Action } from '../planning/Action.js';
import { WorldState } from '../planning/WorldState.js';
import { BurstFire } from './burst.js';

const AIM_TOLERANCE = 5 * DEG; // how closely aimed it must be before it fires

/**
 * Shoot the target in the open: turn to face it, wait out the reaction time,
 * then fire bursts of three. Needs a loaded weapon and a visible target, and
 * is for an agent NOT in cover (in cover it peeks or blind-fires instead); if
 * the target or ammo goes away mid-fight the agent re-plans (Reload first, say).
 */
export class Attack extends Action {
  id = 'Attack';
  cost = 1;
  barkPriority = 1; // the combat callout is never drowned out by idle chatter
  preconditions = WorldState.from({ TargetVisible: true, WeaponLoaded: true, InCover: false });
  effects = WorldState.from({ TargetDead: true });

  #burst = new BurstFire();

  isStillValid({ memory, weapon }) {
    return memory.target !== null && weapon.ammo > 0 && weapon.reloadLeft === 0;
  }

  activate({ fsm, weapon }) {
    this.#burst.reset(weapon);
    fsm.animate({ tick: (ctx, elapsed, dt, intent) => this.#fight(ctx, dt, intent) });
  }

  #fight({ agent, memory, weapon, now }, dt, intent) {
    const { target } = memory;
    if (!target) return;

    const wanted = Math.atan2(target.y - agent.y, target.x - agent.x);
    intent.aimAngle = rotateToward(agent.aimAngle, wanted, agent.def.turnRate * dt);

    const ready = this.#burst.update(weapon, dt);
    const aimed = Math.abs(angleDiff(intent.aimAngle, wanted)) <= AIM_TOLERANCE;
    const reacted = now - memory.visibleSince >= agent.def.reactionTime;
    intent.fire = aimed && reacted && ready;
  }
}
