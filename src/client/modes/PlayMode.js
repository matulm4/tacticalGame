import { lerp } from '../../core/math.js';
import { isHostile } from '../../sim/defs/teams.js';
import { aiInfo, coverNodes, squadInfo, visionCones } from '../../sim/debug/DebugProbe.js';
import { TICK_RATE } from '../../sim/defs/tuning.js';
import { Simulation } from '../../sim/world/Simulation.js';
import { PlayerInputAdapter } from '../input/PlayerInputAdapter.js';
import { EventPresenter } from '../render/EventPresenter.js';
import { Renderer } from '../render/Renderer.js';
import { theme } from '../render/theme.js';
import { AgentLayer } from '../render/layers/AgentLayer.js';
import { BulletLayer } from '../render/layers/BulletLayer.js';
import { CrosshairLayer } from '../render/layers/CrosshairLayer.js';
import { EffectsLayer } from '../render/layers/EffectsLayer.js';
import { TerrainLayer } from '../render/layers/TerrainLayer.js';
import { BubbleLayer } from '../render/layers/BubbleLayer.js';
import { CoverOverlay } from '../render/overlays/CoverOverlay.js';
import { PlanOverlay } from '../render/overlays/PlanOverlay.js';
import { SoundOverlay } from '../render/overlays/SoundOverlay.js';
import { SquadOverlay } from '../render/overlays/SquadOverlay.js';
import { VisionOverlay } from '../render/overlays/VisionOverlay.js';
import { Hud } from '../ui/Hud.js';
import { Screens } from '../ui/Screens.js';

/**
 * Play mode: runs a Simulation, feeds it the player's input every tick, and
 * draws it. Everything the simulation exposes is read-only from here except
 * setPlayerInput(), step() and restart().
 */
export class PlayMode {
  #canvas;
  #camera;
  #input;
  #hudElement;
  #debugFlags;
  #adapter;
  #renderer;
  #hud;
  #screens;
  #presenter = new EventPresenter();
  #sim;

  /**
   * @param {object} options
   * @param {HTMLCanvasElement} options.canvas
   * @param {import('../render/Camera.js').Camera} options.camera
   * @param {import('../input/InputManager.js').InputManager} options.input
   * @param {HTMLElement} options.hudElement
   * @param {HTMLElement} options.screensElement  holds the end-of-match overlay
   * @param {object} options.map   a parsed map file
   * @param {number} options.seed
   * @param {import('../DebugFlags.js').DebugFlags} options.debugFlags  which overlays are on
   * @param {() => void} options.onEditor  asked for by the end-of-match overlay
   */
  constructor({ canvas, camera, input, hudElement, screensElement, map, seed, debugFlags, onEditor }) {
    this.#canvas = canvas;
    this.#camera = camera;
    this.#input = input;
    this.#hudElement = hudElement;
    this.#debugFlags = debugFlags;
    this.#adapter = new PlayerInputAdapter(input, camera);
    this.#hud = new Hud(hudElement);
    this.#screens = new Screens(screensElement, { onRestart: () => this.restart(), onEditor });
    this.#sim = new Simulation(map, { seed });
    this.#renderer = new Renderer(canvas, camera, theme, [
      new TerrainLayer(),
      new SoundOverlay(),
      new VisionOverlay(),
      new CoverOverlay(),
      new BulletLayer(),
      new AgentLayer(),
      new EffectsLayer(),
      new SquadOverlay(),
      new PlanOverlay(),
      new BubbleLayer(),
      new CrosshairLayer(),
    ]);
    camera.setWorldSize(this.#sim.map.width, this.#sim.map.height);
    this.#followPlayer(1); // aiming needs a valid camera before the first frame is drawn
  }

  get sim() {
    return this.#sim;
  }

  enter() {
    this.#canvas.style.cursor = 'none'; // the crosshair replaces the pointer
  }

  exit() {
    this.#canvas.style.cursor = '';
    this.#hudElement.replaceChildren();
    this.#screens.hide();
  }

  resize() {
    this.#renderer.resize();
  }

  /** Start the match over on the same map. */
  restart() {
    this.#sim.restart((Math.random() * 2 ** 32) >>> 0);
    this.#presenter.clear();
    this.#screens.hide();
    this.#followPlayer(1);
  }

  /** One fixed simulation tick. */
  update(dt) {
    this.#sim.setPlayerInput(this.#adapter.read());
    this.#sim.step(dt);

    const events = this.#sim.drainEvents();
    this.#presenter.handle(events);
    for (const event of events) {
      if (event.type === 'matchEnded') this.#screens.show(event.outcome);
    }
  }

  render(alpha) {
    this.#handleHotkeys();

    const world = this.#sim.world;
    const time = world.time + alpha / TICK_RATE;
    this.#presenter.prune(time);
    this.#followPlayer(alpha);

    const mouse = this.#input.mouse;
    const player = world.player;
    this.#renderer.render(
      {
        map: this.#sim.map,
        world,
        effects: this.#presenter.effects,
        crosshair: mouse.active ? this.#camera.screenToWorld(mouse.x, mouse.y) : null,
        time,
        playerCrouched: Boolean(player?.crouched),
        debug: this.#debugFlags,
        visionCones: this.#debugFlags.vision ? visionCones(world) : [],
        aiInfo: this.#debugFlags.plan || this.#debugFlags.cover ? aiInfo(world) : [],
        coverNodes: this.#debugFlags.cover ? coverNodes(world) : [],
        squads: this.#debugFlags.squads ? squadInfo(world) : [],
      },
      alpha,
    );
    this.#hud.update(player, enemyCounts(world));
  }

  /** Per-frame keys (so they also work while the simulation is paused). */
  #handleHotkeys() {
    const input = this.#input;
    if (input.consumePressed('toggleVision')) this.#debugFlags.toggle('vision');
    if (input.consumePressed('toggleNoise')) this.#debugFlags.toggle('noise');
    if (input.consumePressed('togglePlan')) this.#debugFlags.toggle('plan');
    if (input.consumePressed('toggleCover')) this.#debugFlags.toggle('cover');
    if (input.consumePressed('toggleSquads')) this.#debugFlags.toggle('squads');
    // Always consume the key, but only act on it once the match is over.
    const restart = input.consumePressed('restart');
    if (restart && this.#sim.world.result) this.restart();
  }

  /** Close-up camera: centered on the player's interpolated position. */
  #followPlayer(alpha) {
    const player = this.#sim.world.player;
    if (!player) return;
    this.#camera.follow(lerp(player.prevX, player.x, alpha), lerp(player.prevY, player.y, alpha));
  }
}

function enemyCounts(world) {
  const { player } = world;
  let alive = 0;
  let total = 0;
  for (const agent of world.agents) {
    if (!isHostile(player.team, agent.team)) continue;
    total++;
    if (agent.alive) alive++;
  }
  return { alive, total };
}
