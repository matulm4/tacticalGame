import { Goal } from '../planning/Goal.js';
import { WorldState } from '../planning/WorldState.js';

/** The default when nothing else applies: stay alert and look around. It is never "done". */
export class Idle extends Goal {
  id = 'Idle';

  relevance() {
    return this.priority;
  }

  goalState() {
    return WorldState.from({ OnWatch: true });
  }
}
