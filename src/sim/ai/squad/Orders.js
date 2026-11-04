// What a squad can tell one of its members to do. An order sits in the member's
// working memory (see WorkingMemory.giveOrder); the FollowOrder goal makes the
// agent want to carry it out, and the planner picks the action that can (an
// agent that cannot do what the order asks simply cannot plan it). Each order
// carries when it was given, when it runs out, and whether it has been carried out.
//
//   goto-cover   run to this cover position (`node`) and take cover there
//   suppress     keep firing at this spot (`target`, kept up to date by the squad)
//   search       go to this spot (`point`) and look around

export const ORDER_TYPES = Object.freeze(['goto-cover', 'suppress', 'search']);

function order(type, { behavior, squadId, now, timeout, ...payload }) {
  return { type, behavior, squadId, issuedAt: now, expiresAt: now + timeout, fulfilled: false, ...payload };
}

/** @param {{ node: object }} options  `node` is a cover position (see cover/CoverGenerator.js) */
export const gotoCoverOrder = (options) => order('goto-cover', options);

/** @param {{ target: { x: number, y: number } }} options */
export const suppressOrder = (options) => order('suppress', options);

/** @param {{ point: { x: number, y: number } }} options */
export const searchOrder = (options) => order('search', options);
