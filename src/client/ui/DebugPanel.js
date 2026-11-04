import { DebugFlags } from '../DebugFlags.js';

const REFRESH_MS = 250;
const TIME_SCALES = [0.25, 0.5, 1];
const FLAG_LABELS = { vision: 'Vision (V)', noise: 'Noise (N)', plan: 'Plan (P)', cover: 'Cover (C)', squads: 'Squads (Q)' };

function button(label, onClick) {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = label;
  node.addEventListener('click', onClick);
  return node;
}

/**
 * Debug panel: loop stats, pause / step / time-scale / restart controls, and
 * the overlay toggles (enemy view cones, sound rings).
 */
export class DebugPanel {
  #stats;
  #pauseButton;
  #lastRefresh = 0;

  /**
   * @param {HTMLElement} container
   * @param {object} options
   * @param {DebugFlags} options.flags
   * @param {(paused: boolean) => void} options.onPause
   * @param {() => void} options.onStep
   * @param {(scale: number) => void} options.onTimeScale
   * @param {() => void} options.onRestart
   */
  constructor(container, { flags, onPause, onStep, onTimeScale, onRestart }) {
    this.#stats = document.createElement('pre');

    this.#pauseButton = button('Pause', () => {
      const paused = this.#pauseButton.getAttribute('aria-pressed') !== 'true';
      this.#pauseButton.setAttribute('aria-pressed', String(paused));
      onPause(paused);
    });
    this.#pauseButton.setAttribute('aria-pressed', 'false');

    const controls = document.createElement('div');
    controls.className = 'row';
    controls.append(
      this.#pauseButton,
      button('Step', onStep),
      ...TIME_SCALES.map((scale) => button(`${scale}x`, () => onTimeScale(scale))),
    );

    const toggles = document.createElement('div');
    toggles.className = 'row';
    const flagButtons = DebugFlags.NAMES.map((name) => [name, button(FLAG_LABELS[name], () => flags.toggle(name))]);
    toggles.append(...flagButtons.map(([, node]) => node), button('Restart', onRestart));
    const refreshFlags = () => {
      for (const [name, node] of flagButtons) node.setAttribute('aria-pressed', String(flags[name]));
    };
    flags.subscribe(refreshFlags);
    refreshFlags();

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Tab: back to the editor';

    container.append(this.#stats, controls, toggles, hint);
  }

  /** Throttled; safe to call every frame. */
  updateStats(stats, now = performance.now()) {
    if (now - this.#lastRefresh < REFRESH_MS) return;
    this.#lastRefresh = now;
    this.#stats.textContent =
      `fps    ${stats.fps.toFixed(1)}\n` +
      `ticks/s ${stats.tps.toFixed(1)}\n` +
      `ticks  ${stats.ticks}\n` +
      `speed  ${stats.timeScale}x${stats.paused ? '  (paused)' : ''}`;
  }
}
