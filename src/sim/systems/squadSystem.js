/** Lets the squads think (share sightings, run their behaviors) before the agents decide. */
export function squadSystem(world) {
  world.squads.update(world);
}
