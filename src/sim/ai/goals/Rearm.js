import { Goal } from '../planning/Goal.js';
import { WorldState } from '../planning/WorldState.js';

/** Top up the magazine when nothing is happening. */
export class Rearm extends Goal {
  id = 'Rearm';

  relevance(ctx) {
    if (ctx.memory.target) return 0;
    return ctx.weapon.ammo < ctx.weapon.def.magSize ? this.priority : 0;
  }

  goalState() {
    return WorldState.from({ WeaponFull: true });
  }
}
