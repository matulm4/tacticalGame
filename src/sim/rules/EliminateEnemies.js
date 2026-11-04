import { isHostile } from '../defs/teams.js';

/**
 * The default game mode: kill every enemy to win, die and you lose.
 *
 * A game rule is an object with start(world), called once when the world is
 * built, and update(world), called every tick. It decides the outcome by setting
 * `world.result` and emitting 'matchEnded' (once). New modes are new files here.
 *
 * A map with no enemies has nothing to win, so it is a sandbox: only losing applies.
 */
export class EliminateEnemies {
  #hasEnemies = false;

  start(world) {
    const player = world.player;
    this.#hasEnemies = world.agents.some((agent) => isHostile(player.team, agent.team));
  }

  update(world) {
    if (world.result) return;
    const player = world.player;

    if (!player.alive) return this.#end(world, 'lose');

    const enemiesLeft = world.agents.some((agent) => agent.alive && isHostile(player.team, agent.team));
    if (this.#hasEnemies && !enemiesLeft) this.#end(world, 'win');
  }

  #end(world, outcome) {
    world.result = { outcome };
    world.emit('matchEnded', { outcome });
  }
}
