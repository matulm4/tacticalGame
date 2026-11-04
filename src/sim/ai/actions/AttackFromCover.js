import { DEG, angleDiff } from '../../../core/math.js';
import { peekPoint, sightRange } from '../cover/CoverQuery.js';
import { Action } from '../planning/Action.js';
import { WorldState } from '../planning/WorldState.js';
import { BurstFire } from './burst.js';
import { faceToward, stepToward } from './coverMoves.js';

const AIM_TOLERANCE = 5 * DEG;
const HIDE_TIME = 0.5; // seconds crouched behind cover before each peek
const PEEK_PATIENCE = 1.2; // seconds at the peek spot waiting for a clear shot before ducking back

/**
 * Fight from cover, the paper's way: hide crouched, step out to where the
 * threat can be seen (up from behind low cover, along the wall past the corner
 * of high cover), fire a burst, duck back, wait, and repeat. Only for an agent
 * in cover that is not under fire (then it blind-fires instead), and only
 * possible when there is somewhere to peek from.
 */
export class AttackFromCover extends Action {
  id = 'AttackFromCover';
  cost = 3;
  barkPriority = 1;
  preconditions = WorldState.from({ InCover: true, WeaponLoaded: true, UnderFire: false });
  effects = WorldState.from({ TargetDead: true });

  #burst = new BurstFire();
  #phase = 'hide';
  #phaseTime = 0;
  #peek = null;

  checkProceduralPreconditions(ctx) {
    return Boolean(ctx.coverNode && ctx.threat) && this.#findPeek(ctx) !== null;
  }

  isStillValid({ inCover, threat, weapon, memory, now }) {
    return inCover && threat !== null && weapon.ammo > 0 && weapon.reloadLeft === 0 && !memory.isUnderFire(now);
  }

  activate({ fsm, weapon }) {
    this.#burst.reset(weapon);
    this.#enter('hide');
    fsm.animate({ tick: (ctx, elapsed, dt, intent) => this.#tick(ctx, dt, intent) });
  }

  update(ctx) {
    // No way to see the threat from this cover any more: let the agent plan something else.
    return this.#phase === 'hide' && this.#findPeek(ctx) === null ? 'failed' : 'running';
  }

  #enter(phase) {
    this.#phase = phase;
    this.#phaseTime = 0;
  }

  #findPeek({ agent, world, coverNode, threat }) {
    const crouched = Boolean(world.getAgent(threat.id)?.crouched);
    return peekPoint(world, coverNode, threat, crouched, sightRange(agent.def, crouched));
  }

  #tick(ctx, dt, intent) {
    const { agent, coverNode, threat, weapon, memory } = ctx;
    if (!coverNode || !threat) return;
    this.#phaseTime += dt;
    const ready = this.#burst.update(weapon, dt);
    const wanted = faceToward(agent, threat, dt, intent);

    switch (this.#phase) {
      case 'hide':
        intent.crouch = true;
        stepToward(agent, coverNode, intent);
        if (this.#phaseTime >= HIDE_TIME && Math.hypot(agent.x - coverNode.x, agent.y - coverNode.y) < 8) {
          this.#peek = this.#findPeek(ctx);
          if (this.#peek) this.#enter('peek');
        }
        break;

      case 'peek':
        if (stepToward(agent, this.#peek, intent) || this.#phaseTime > 1) this.#enter('fire');
        break;

      case 'fire': {
        const aimed = Math.abs(angleDiff(intent.aimAngle, wanted)) <= AIM_TOLERANCE;
        const clear = memory.target !== null;
        intent.fire = clear && aimed && ready;
        if (this.#burst.resting || this.#phaseTime > PEEK_PATIENCE + (clear ? 1 : 0)) this.#enter('duck');
        break;
      }

      case 'duck':
        intent.crouch = true;
        if (stepToward(agent, coverNode, intent) && this.#phaseTime > 0.4) this.#enter('hide');
        break;
    }
  }
}
