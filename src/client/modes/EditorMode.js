import { isTypingTarget } from '../input/domUtils.js';
import { EditorRenderer } from '../render/EditorRenderer.js';
import { theme } from '../render/theme.js';

const TOOL_KEYS = {
  KeyV: 'select',
  KeyR: 'rect',
  KeyC: 'circle',
  KeyP: 'playerStart',
  KeyE: 'enemySpawn',
};

const NUDGE_KEYS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Editor mode: shows the whole map and turns the mouse and keyboard into calls
 * on the EditorState. The editing logic itself lives in src/editor.
 *
 * Mouse: tool actions (Shift / Alt modify them, see the tools).
 * Keys: V select, R rectangle, C circle, P player start, E enemy spawn,
 *       H cover height, G snap, Delete remove, arrows nudge, Esc cancel,
 *       Ctrl/Cmd+Z undo, +Shift (or Ctrl+Y) redo, Ctrl/Cmd+S save.
 */
export class EditorMode {
  #canvas;
  #camera;
  #editor;
  #renderer;
  #onSave;
  #abort = null;

  /**
   * @param {object} options
   * @param {HTMLCanvasElement} options.canvas
   * @param {import('../render/Camera.js').Camera} options.camera
   * @param {import('../../editor/EditorState.js').EditorState} options.editor
   * @param {() => void} options.onSave  called for Ctrl/Cmd+S
   */
  constructor({ canvas, camera, editor, onSave }) {
    this.#canvas = canvas;
    this.#camera = camera;
    this.#editor = editor;
    this.#onSave = onSave;
    this.#renderer = new EditorRenderer(canvas, camera, theme);
  }

  enter() {
    this.#fitCamera();

    this.#abort = new AbortController();
    const options = { signal: this.#abort.signal };
    this.#canvas.addEventListener('mousedown', this.#onMouseDown, options);
    this.#canvas.addEventListener('contextmenu', (event) => event.preventDefault(), options);
    window.addEventListener('mousemove', this.#onMouseMove, options);
    window.addEventListener('mouseup', this.#onMouseUp, options);
    window.addEventListener('keydown', this.#onKeyDown, options);
  }

  exit() {
    this.#abort?.abort();
    this.#abort = null;
    this.#editor.tool.cancel();
    this.#canvas.style.cursor = '';
  }

  resize() {
    this.#renderer.resize();
  }

  update() {}

  render() {
    const editor = this.#editor;
    this.#fitCamera();
    editor.pixelSize = 1 / this.#camera.scale;
    this.#canvas.style.cursor = editor.tool.cursor;
    this.#renderer.render(editor);
  }

  /** The map can be swapped (open file, sample, new), so keep the camera fitted to it. */
  #fitCamera() {
    const { width, height } = this.#editor.map;
    if (this.#camera.worldWidth !== width || this.#camera.worldHeight !== height) {
      this.#camera.setWorldSize(width, height);
    }
    if (this.#camera.mode !== 'fit') this.#camera.fitToWorld();
  }

  #world(event) {
    const rect = this.#canvas.getBoundingClientRect();
    return this.#camera.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
  }

  #mods = (event) => ({ shift: event.shiftKey, alt: event.altKey });

  #onMouseDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    this.#editor.pointerDown(this.#world(event), this.#mods(event));
  };

  #onMouseMove = (event) => {
    this.#editor.pointerMove(this.#world(event), this.#mods(event));
  };

  #onMouseUp = (event) => {
    if (event.button !== 0) return;
    this.#editor.pointerUp(this.#world(event), this.#mods(event));
  };

  #onKeyDown = (event) => {
    if (isTypingTarget(event.target) || event.altKey) return;
    const editor = this.#editor;

    if (event.metaKey || event.ctrlKey) {
      if (event.code === 'KeyZ') {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
      } else if (event.code === 'KeyY') {
        event.preventDefault();
        editor.redo();
      } else if (event.code === 'KeyS') {
        event.preventDefault();
        this.#onSave();
      }
      return;
    }

    if (event.code in TOOL_KEYS) {
      editor.setTool(TOOL_KEYS[event.code]);
    } else if (event.code in NUDGE_KEYS) {
      event.preventDefault();
      editor.nudgeSelection(...NUDGE_KEYS[event.code]);
    } else if (event.code === 'Delete' || event.code === 'Backspace') {
      event.preventDefault();
      editor.deleteSelection();
    } else if (event.code === 'Escape') {
      editor.escape();
    } else if (event.code === 'KeyH') {
      editor.toggleCoverHeight();
    } else if (event.code === 'KeyG') {
      editor.toggleSnap();
    }
  };
}
