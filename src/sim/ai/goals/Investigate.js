import { Goal } from '../planning/Goal.js';
import { WorldState } from '../planning/WorldState.js';

/**
 * Find out what that noise was, or where the hostile went: wanted when nothing
 * is in view but there is a recent noise or last sighting not yet checked.
 * How it gets satisfied (walk there, or just turn to look) is up to the
 * actions the agent has.
 */
export class Investigate extends Goal {
  id = 'Investigate';

  relevance(ctx) {
    if (ctx.memory.target) return 0;
    return ctx.memory.investigationPoint(ctx.now) ? this.priority : 0;
  }

  goalState() {
    return WorldState.from({ Investigated: true });
  }

  /** 'noise' or 'lostSight': picks the chatter line. */
  tag(ctx) {
    return ctx.memory.investigationPoint(ctx.now)?.reason ?? null;
  }
}
