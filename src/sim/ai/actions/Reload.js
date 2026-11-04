import { rotateToward } from '../../../core/math.js';
import { Action } from '../planning/Action.js';
import { WorldState } from '../planning/WorldState.js';

/** Refill the magazine. While it reloads, the agent keeps facing its target. */
export class Reload extends Action {
  id = 'Reload';
  cost = 2;
  effects = WorldState.from({ WeaponLoaded: true, WeaponFull: true });

  activate({ fsm }) {
    fsm.animate({
      tick: ({ agent, memory, weapon }, elapsed, dt, intent) => {
        intent.reload = true;
        if (memory.target) {
          const wanted = Math.atan2(memory.target.y - agent.y, memory.target.x - agent.x);
          intent.aimAngle = rotateToward(agent.aimAngle, wanted, agent.def.turnRate * dt);
        }
        return weapon.ammo === weapon.def.magSize && weapon.reloadLeft === 0;
      },
    });
  }

  update({ fsm }) {
    return fsm.status === 'done' ? 'done' : 'running';
  }
}
