// Chatter lines, one per action (the arrays leave room for variants later).
// An action offers keys, most specific first; the first one that has lines is
// used. "Action:Goal:tag" can say different things for the same action when it
// serves different goals or reasons.

export const BARKS = Object.freeze({
  Attack: ['Opening fire!'],
  Reload: ['Reloading!'],
  LookAround: ['All quiet...'],
  LookAtNoise: ['Did you hear that?'],
  'InvestigatePoint:noise': ['What was that?'],
  'InvestigatePoint:lostSight': ['Lost sight! Checking it out!'],
  'GotoNode:ReturnToPost': ['Back to my post.'],
  'GotoNode:Cover': ['Taking cover!'],
  AttackFromCover: ['Covering fire!'],
  BlindFireFromCover: ['Keep your head down!'],
  DodgeShuffle: ['Look out!'],
  DodgeCovered: ['Ducking!'],
  'MoveToCover:getToCover': ['Get to cover!'],
  'MoveToCover:advance': ['Moving up!'],
  SuppressFire: ['Suppressing fire!'],
  SearchPoint: ['Spread out! Find them!'],
});
