import { peekPoint } from '../cover/CoverQuery.js';
import { Action } from '../planning/Action.js';
import { WorldState } from '../planning/WorldState.js';
import { BurstFire } from './burst.js';
import { faceToward, stepToward } from './coverMoves.js';

/**
 * When bullets are flying past, stay down and fire without looking: the gun
 * goes out with the body still hidden. Behind low cover the agent stays
 * crouched and holds the gun over the top (those blind shots fly over low
 * cover); behind high cover the arm reaches round the corner. Very inaccurate,
 * but it keeps the other side's head down. Needs cover, and for high cover a
 * corner to reach round.
 */
export class BlindFireFromCover extends Action {
  id = 'BlindFireFromCover';
  cost = 3;
  barkPriority = 2; // the shout for suppressing fire is heard over "covering fire"
  preconditions = WorldState.from({ InCover: true, WeaponLoaded: true, UnderFire: true });
  effects = WorldState.from({ TargetDead: true });

  #burst = new BurstFire();

  checkProceduralPreconditions(ctx) {
    return Boolean(ctx.coverNode && ctx.threat) && armOffset(ctx) !== null;
  }

  isStillValid({ inCover, threat, weapon, memory, now }) {
    return inCover && threat !== null && weapon.ammo > 0 && weapon.reloadLeft === 0 && memory.isUnderFire(now);
  }

  activate({ fsm, weapon }) {
    this.#burst.reset(weapon);
    fsm.animate({ tick: (ctx, elapsed, dt, intent) => this.#tick(ctx, dt, intent) });
  }

  update(ctx) {
    return armOffset(ctx) === null ? 'failed' : 'running';
  }

  #tick(ctx, dt, intent) {
    const { agent, coverNode, threat, weapon } = ctx;
    if (!coverNode || !threat) return;

    intent.crouch = true;
    const atCover = stepToward(agent, coverNode, intent);
    faceToward(agent, threat, dt, intent);

    const ready = this.#burst.update(weapon, dt);
    const offset = armOffset(ctx);
    if (atCover && ready && offset) {
      intent.fire = true;
      intent.blind = offset;
    }
  }
}

/**
 * Where the hand goes relative to the body for a blind shot, or null if it
 * cannot be done from here: over low cover the hand stays put; round the corner
 * of high cover it goes out to the spot the agent would peek from (so it needs
 * a corner it could peek past).
 */
export function armOffset({ world, coverNode, threat }) {
  if (coverNode.height === 'low') return { x: 0, y: 0 };

  const peek = peekPoint(world, coverNode, threat, false);
  return peek ? { x: peek.x - coverNode.x, y: peek.y - coverNode.y } : null;
}
