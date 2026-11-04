import { DEG, angleDiff } from '../../../core/math.js';
import { Action } from '../planning/Action.js';
import { WorldState } from '../planning/WorldState.js';
import { armOffset } from './BlindFireFromCover.js';
import { BurstFire } from './burst.js';
import { faceToward, stepToward } from './coverMoves.js';

const AIM_TOLERANCE = 5 * DEG;

/**
 * Carry out a `suppress` order: keep firing, in short bursts, at the spot the
 * squad names, whether or not the enemy can be seen there, to keep its head
 * down while squadmates move. Out in the open the agent stands and shoots; in
 * cover it stays down and fires blind (over low cover, round the corner of
 * high cover) so it keeps its protection. It goes on until the squad stands the
 * order down.
 */
export class SuppressFire extends Action {
  id = 'SuppressFire';
  cost = 2;
  barkPriority = 2; // an order being given is heard over what anyone else is saying
  preconditions = WorldState.from({ WeaponLoaded: true });
  effects = WorldState.from({ OrderPending: false });

  #burst = new BurstFire({ shots: 4, pause: 0.35 });

  checkProceduralPreconditions({ order }) {
    return order?.type === 'suppress';
  }

  isStillValid({ order, weapon }) {
    return order?.type === 'suppress' && weapon.ammo > 0 && weapon.reloadLeft === 0;
  }

  activate({ fsm, weapon }) {
    this.#burst.reset(weapon);
    fsm.animate({ tick: (ctx, elapsed, dt, intent) => this.#tick(ctx, dt, intent) });
  }

  #tick(ctx, dt, intent) {
    const { agent, order, weapon, world, coverNode, inCover } = ctx;
    if (!order) return;

    const wanted = faceToward(agent, order.target, dt, intent);
    const aimed = Math.abs(angleDiff(intent.aimAngle, wanted)) <= AIM_TOLERANCE;
    const ready = this.#burst.update(weapon, dt);

    if (inCover && coverNode) {
      intent.crouch = true;
      const atCover = stepToward(agent, coverNode, intent);
      const arm = armOffset({ world, coverNode, threat: order.target });
      if (atCover && arm && aimed && ready) {
        intent.fire = true;
        intent.blind = arm;
      }
    } else if (aimed && ready) {
      intent.fire = true;
    }
  }
}
