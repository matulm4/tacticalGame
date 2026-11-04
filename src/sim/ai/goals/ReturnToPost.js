import { Goal } from '../planning/Goal.js';
import { WorldState } from '../planning/WorldState.js';

const AWAY_DISTANCE = 40; // farther than this from its post and the agent wants to go back

/** Go back to the place the agent was stationed at, once nothing else needs doing. */
export class ReturnToPost extends Goal {
  id = 'ReturnToPost';

  relevance(ctx) {
    const { agent, home } = ctx;
    return Math.hypot(agent.x - home.x, agent.y - home.y) > AWAY_DISTANCE ? this.priority : 0;
  }

  goalState(ctx) {
    return WorldState.from({ AtNode: ctx.homeNode });
  }
}
