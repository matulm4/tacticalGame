import { isTypingTarget } from './domUtils.js';
import { KEY_BINDINGS } from './keybindings.js';

/**
 * Owns the DOM input listeners and exposes a polled view of them:
 * held keys, key presses (edge-triggered, consumed once) and the mouse in
 * canvas pixels. The game never reads DOM events directly.
 */
export class InputManager {
  #canvas;
  #bindings;
  #boundCodes;
  #keysDown = new Set();
  #pressed = new Set();
  #buttonsDown = new Set();
  #abort = new AbortController();

  /** Mouse position in canvas CSS pixels; `active` flips true after the first move. */
  mouse = { x: 0, y: 0, active: false };

  constructor(canvas, bindings = KEY_BINDINGS) {
    this.#canvas = canvas;
    this.#bindings = bindings;
    this.#boundCodes = new Set(Object.values(bindings).flat());

    const options = { signal: this.#abort.signal };
    window.addEventListener('keydown', this.#onKeyDown, options);
    window.addEventListener('keyup', this.#onKeyUp, options);
    window.addEventListener('mousemove', this.#onMouseMove, options);
    window.addEventListener('mousedown', this.#onMouseDown, options);
    window.addEventListener('mouseup', this.#onMouseUp, options);
    window.addEventListener('contextmenu', this.#onContextMenu, options);
    window.addEventListener('blur', this.#releaseAll, options);
    document.addEventListener('visibilitychange', this.#releaseAll, options);
  }

  /** Is any key bound to `action` currently held? */
  isDown(action) {
    return this.#bindings[action].some((code) => this.#keysDown.has(code));
  }

  /** True once per physical key press of `action`, however many ticks pass. */
  consumePressed(action) {
    let pressed = false;
    for (const code of this.#bindings[action]) {
      if (this.#pressed.delete(code)) pressed = true;
    }
    return pressed;
  }

  isMouseDown(button) {
    return this.#buttonsDown.has(button);
  }

  /** Forget all held keys and buttons (used when switching between editor and play). */
  reset() {
    this.#releaseAll();
  }

  dispose() {
    this.#abort.abort();
  }

  #onKeyDown = (event) => {
    if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!this.#keysDown.has(event.code)) this.#pressed.add(event.code);
    this.#keysDown.add(event.code);
    if (this.#boundCodes.has(event.code)) event.preventDefault();
  };

  #onKeyUp = (event) => {
    this.#keysDown.delete(event.code);
  };

  #onMouseMove = (event) => {
    const rect = this.#canvas.getBoundingClientRect();
    this.mouse.x = event.clientX - rect.left;
    this.mouse.y = event.clientY - rect.top;
    this.mouse.active = true;
  };

  #onMouseDown = (event) => {
    if (event.target !== this.#canvas) return;
    this.#buttonsDown.add(event.button);
    event.preventDefault();
  };

  #onMouseUp = (event) => {
    this.#buttonsDown.delete(event.button);
  };

  #onContextMenu = (event) => {
    if (event.target === this.#canvas) event.preventDefault();
  };

  /** Losing focus must not leave keys or buttons stuck down. */
  #releaseAll = () => {
    this.#keysDown.clear();
    this.#pressed.clear();
    this.#buttonsDown.clear();
  };
}
