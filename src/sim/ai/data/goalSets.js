import { Cover } from '../goals/Cover.js';
import { Dodge } from '../goals/Dodge.js';
import { FollowOrder } from '../goals/FollowOrder.js';
import { Idle } from '../goals/Idle.js';
import { Investigate } from '../goals/Investigate.js';
import { KillEnemy } from '../goals/KillEnemy.js';
import { Rearm } from '../goals/Rearm.js';
import { ReturnToPost } from '../goals/ReturnToPost.js';

// Which goals an archetype has (its `goalSet`), and how much each matters when it applies.
// Goals compete: the agent plans for the highest priority one it can find a plan for.
// Each agent gets its own instances.

export const GOAL_SETS = Object.freeze({
  soldier: () => [
    new Dodge({ priority: 85 }),
    new FollowOrder({ priority: 75 }),
    new Cover({ priority: 65 }),
    new KillEnemy({ priority: 60 }),
    new Investigate({ priority: 40 }),
    new Rearm({ priority: 30 }),
    new ReturnToPost({ priority: 25 }),
    new Idle({ priority: 1 }),
  ],
});
