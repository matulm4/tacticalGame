import { generateCover } from '../ai/cover/CoverGenerator.js';
import { NavGrid } from '../ai/nav/NavGrid.js';
import { PlayerController } from '../controllers/PlayerController.js';
import { TICK_RATE } from '../defs/tuning.js';
import { StaticWorld } from '../map/StaticWorld.js';
import { validateMap } from '../map/mapSchema.js';
import { EliminateEnemies } from '../rules/EliminateEnemies.js';
import { controllerSystem } from '../systems/controllerSystem.js';
import { movementSystem } from '../systems/movementSystem.js';
import { projectileSystem } from '../systems/projectileSystem.js';
import { rulesSystem } from '../systems/rulesSystem.js';
import { squadSystem } from '../systems/squadSystem.js';
import { soundSystem } from '../systems/soundSystem.js';
import { stanceSystem } from '../systems/stanceSystem.js';
import { weaponSystem } from '../systems/weaponSystem.js';
import { World } from './World.js';
import { spawnAgents } from './spawner.js';

/**
 * The public face of the game logic. The client creates one, pushes the
 * player's input in, calls step() at a fixed rate, and drains events out.
 * No DOM, no wall-clock time: same map + seed + inputs give the same result.
 */
export class Simulation {
  #createRule;
  #staticWorld;
  #nav;
  #coverNodes;

  /**
   * @param {object} mapData  a parsed map file (validated here)
   * @param {object} [options]
   * @param {number} [options.seed]
   * @param {() => object} [options.createRule]  makes the game mode (default: kill all enemies)
   */
  constructor(mapData, { seed = 1, createRule = () => new EliminateEnemies() } = {}) {
    const result = validateMap(mapData);
    if (!result.ok) throw new Error(`Invalid map: ${result.errors.join('; ')}`);
    if (!result.map.playerStart) throw new Error('Map has no player start');

    this.map = result.map;
    this.seed = seed;
    this.#createRule = createRule;
    this.playerController = new PlayerController();

    // The level never changes during play, so these are built once and shared by restarts.
    this.#staticWorld = new StaticWorld(this.map);
    this.#nav = new NavGrid(this.#staticWorld);
    this.#coverNodes = generateCover(this.#staticWorld, this.#nav);
    this.world = this.#build();
  }

  #build() {
    const world = new World({
      staticWorld: this.#staticWorld,
      nav: this.#nav,
      coverNodes: this.#coverNodes,
      seed: this.seed,
    });
    spawnAgents(world, this.map, this.playerController);
    world.rule = this.#createRule();
    world.rule.start(world);
    return world;
  }

  /** Advance the world by one fixed tick. */
  step(dt = 1 / TICK_RATE) {
    const world = this.world;
    world.tick += 1;
    world.time += dt;

    for (const agent of world.agents) {
      agent.prevX = agent.x;
      agent.prevY = agent.y;
    }

    squadSystem(world, dt);
    controllerSystem(world, dt);
    stanceSystem(world);
    movementSystem(world, dt);
    weaponSystem(world, dt);
    soundSystem(world);
    projectileSystem(world, dt);
    rulesSystem(world);
  }

  /** See PlayerInput in controllers/PlayerController.js. */
  setPlayerInput(input) {
    this.playerController.setInput(input);
  }

  /** Events emitted since the last call (shots, hits, sounds, ...). */
  drainEvents() {
    return this.world.events.drain();
  }

  restart(seed = this.seed) {
    this.seed = seed;
    this.world = this.#build();
  }
}
