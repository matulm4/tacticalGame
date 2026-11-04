/** Lets the game mode check whether the match has been decided. */
export function rulesSystem(world) {
  world.rule?.update(world);
}
