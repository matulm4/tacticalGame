import { Goal } from '../planning/Goal.js';
import { WorldState } from '../planning/WorldState.js';

/**
 * Get behind cover: wanted when there is a threat (a hostile in view, or one
 * that was a moment ago) and the agent is not in cover, and some cover is
 * within reach. When cover stops hiding the agent from the threat (it moved,
 * or the agent was pushed out) the agent is no longer "in cover" and this goal
 * comes back, so it picks new cover: the paper's reposition, without a second goal.
 */
export class Cover extends Goal {
  id = 'Cover';

  relevance(ctx) {
    if (!ctx.threat || ctx.inCover) return 0;
    return ctx.findCover() ? this.priority : 0;
  }

  goalState(ctx) {
    const { node } = ctx.findCover();
    const handle = ctx.nodes.addOnce(`cover:${node.id}`, { x: node.x, y: node.y, kind: 'cover', cover: node });
    return WorldState.from({ AtNode: handle });
  }
}
