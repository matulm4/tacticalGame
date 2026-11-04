import { Goal } from '../planning/Goal.js';
import { WorldState } from '../planning/WorldState.js';

/**
 * Fight: wanted whenever there is a threat, i.e. a hostile in view or one seen
 * a moment ago (it may be hiding). How to fight (shoot in the open, peek from
 * cover, fire blind) is up to the actions that fit the situation.
 */
export class KillEnemy extends Goal {
  id = 'KillEnemy';

  relevance(ctx) {
    return ctx.threat ? this.priority : 0;
  }

  goalState() {
    return WorldState.from({ TargetDead: true });
  }
}
