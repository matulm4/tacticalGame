// The variables an agent's planner reasons about, one fixed slot each (as in
// the F.E.A.R. paper: the world state is a fixed-size array of values, not a
// list of facts). Booleans are 0 or 1. New behavior that needs a new fact
// adds a variable here.
//
//   TargetVisible  a hostile is in view right now
//   TargetDead     the goal of fighting: the target has been killed
//   WeaponLoaded   the weapon has rounds and is not being reloaded
//   WeaponFull     the magazine is full
//   Investigated   the agent has checked out the noise / last known position
//   OnWatch        the agent has looked around (the idle goal)
//   AtNode         the node the agent stands at (0 = none)
//   InCover        the agent is at its chosen cover, and that cover still hides it from the threat
//   Threatened     a gun is aimed at the agent
//   UnderFire      hostile bullets have been going past the agent
//   OrderPending   the squad has given the agent an order it has not carried out yet

export const VARIABLES = Object.freeze([
  'TargetVisible',
  'TargetDead',
  'WeaponLoaded',
  'WeaponFull',
  'Investigated',
  'OnWatch',
  'AtNode',
  'InCover',
  'Threatened',
  'UnderFire',
  'OrderPending',
]);

/** Variable name -> slot index. */
export const VAR = Object.freeze(Object.fromEntries(VARIABLES.map((name, index) => [name, index])));

/** In a partial state (a goal, a precondition, an effect list): this variable does not matter. */
export const UNSET = -1;

/**
 * As an effect value: "whatever value the goal asks for". It is how one action
 * (GotoNode) can satisfy `AtNode = 5` for any node; the planner records the
 * value it was bound to.
 */
export const PARAM = -2;
