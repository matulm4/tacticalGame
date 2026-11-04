import { EventQueue } from '../../core/eventQueue.js';
import { Rng } from '../../core/rng.js';
import { CoverReservations } from '../ai/cover/CoverReservations.js';
import { BarkSystem } from '../ai/dialogue/BarkSystem.js';
import { SquadCoordinator } from '../ai/squad/SquadCoordinator.js';

/** Mutable simulation state. All randomness comes from `rng`, all time from `time`. */
export class World {
  #nextId = 1;

  /**
   * @param {object} options
   * @param {import('../map/StaticWorld.js').StaticWorld} options.staticWorld
   * @param {import('../ai/nav/NavGrid.js').NavGrid} options.nav  path finding over the same level
   * @param {import('../ai/cover/CoverGenerator.js').CoverNode[]} options.coverNodes  places to take cover
   * @param {number} options.seed
   */
  constructor({ staticWorld, nav, coverNodes, seed }) {
    this.static = staticWorld;
    this.nav = nav;
    this.cover = { nodes: coverNodes, reservations: new CoverReservations() };
    this.squads = new SquadCoordinator();
    this.barks = new BarkSystem();
    this.seed = seed;
    this.time = 0; // simulated seconds
    this.tick = 0;
    this.agents = [];
    this.bullets = [];
    this.sounds = []; // sounds made this tick, waiting for the sound system to deliver them
    this.playerId = null;
    this.rule = null; // the game mode (see sim/rules)
    this.result = null; // set once the match is decided: { outcome: 'win' | 'lose' }
    this.rng = new Rng(seed);
    this.events = new EventQueue();
  }

  nextId() {
    return this.#nextId++;
  }

  /** Emit an event stamped with the current tick and time. */
  emit(type, payload = {}) {
    return this.events.emit(type, { tick: this.tick, time: this.time, ...payload });
  }

  /**
   * Make a noise: { kind, x, y, radius, sourceId, team }. Listeners hear it through the
   * sound system; the event lets the renderer (and later audio) show or play it.
   */
  emitSound(sound) {
    this.sounds.push(sound);
    return this.emit('soundEmitted', sound);
  }

  addAgent(agent) {
    this.agents.push(agent);
    return agent;
  }

  getAgent(id) {
    return this.agents.find((agent) => agent.id === id) ?? null;
  }

  get player() {
    return this.playerId === null ? null : this.getAgent(this.playerId);
  }
}
