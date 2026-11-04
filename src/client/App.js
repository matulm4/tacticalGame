import { EditorState } from '../editor/EditorState.js';
import { TICK_RATE } from '../sim/defs/tuning.js';
import { GameLoop } from './GameLoop.js';
import { isTypingTarget } from './input/domUtils.js';
import { InputManager } from './input/InputManager.js';
import { EditorMode } from './modes/EditorMode.js';
import { PlayMode } from './modes/PlayMode.js';
import { DebugFlags } from './DebugFlags.js';
import { Camera } from './render/Camera.js';
import { theme } from './render/theme.js';
import { MapStorage } from './storage/MapStorage.js';
import { DebugPanel } from './ui/DebugPanel.js';
import { EditorToolbar } from './ui/EditorToolbar.js';

const AUTOSAVE_DELAY_MS = 400;

/**
 * Application shell: owns the editor and the play session and switches between
 * them (Tab). The map being edited is the map that gets played.
 */
export class App {
  #canvas;
  #hudElement;
  #screensElement;
  #debugFlags = new DebugFlags();
  #camera;
  #input;
  #storage;
  #editor;
  #editorMode;
  #playMode = null;
  #mode = null;
  #loop;
  #autosaveTimer = null;

  /**
   * @param {object} options
   * @param {HTMLCanvasElement} options.canvas
   * @param {HTMLElement} options.debugPanelElement
   * @param {HTMLElement} options.hudElement
   * @param {HTMLElement} options.screensElement
   * @param {HTMLElement} options.toolbarElement
   * @param {object} options.map  the map to start with (already validated)
   * @param {MapStorage} [options.storage]
   * @param {'play' | 'editor'} [options.startMode='play']
   */
  constructor({
    canvas,
    debugPanelElement,
    hudElement,
    screensElement,
    toolbarElement,
    map,
    storage = new MapStorage(),
    startMode = 'play',
  }) {
    this.#canvas = canvas;
    this.#hudElement = hudElement;
    this.#screensElement = screensElement;
    this.#storage = storage;
    this.#camera = new Camera({
      worldWidth: map.width,
      worldHeight: map.height,
      visibleHeight: theme.sizes.cameraViewHeight,
    });
    this.#input = new InputManager(canvas);

    this.#editor = new EditorState(map);
    this.#editorMode = new EditorMode({
      canvas,
      camera: this.#camera,
      editor: this.#editor,
      onSave: () => this.#save(),
    });
    const toolbar = new EditorToolbar(toolbarElement, {
      editor: this.#editor,
      onPlay: () => this.#enterPlay(),
      onSave: () => this.#save(),
      onNew: () => this.#newMap(),
      onOpenFile: (file) => this.#openFile(file),
      onSample: (fileName) => this.#openSample(fileName),
    });
    storage
      .fetchSamples()
      .then((samples) => toolbar.setSamples(samples))
      .catch(() => {}); // samples are a convenience; the editor works without them

    const debugPanel = new DebugPanel(debugPanelElement, {
      flags: this.#debugFlags,
      onRestart: () => this.#playMode?.restart(),
      onPause: (paused) => this.#loop.setPaused(paused),
      onStep: () => this.#loop.stepOnce(),
      onTimeScale: (scale) => this.#loop.setTimeScale(scale),
    });
    this.#loop = new GameLoop({
      tickRate: TICK_RATE,
      update: (dt) => this.#mode.update(dt),
      render: (alpha) => {
        this.#mode.render(alpha);
        debugPanel.updateStats(this.#loop.stats);
      },
    });

    this.#editor.subscribe(() => this.#scheduleAutosave());
    window.addEventListener('keydown', (event) => this.#onKeyDown(event));
    new ResizeObserver(() => this.#mode.resize()).observe(canvas);

    this.#activate(this.#editorMode, 'editor');
    if (startMode === 'play') this.#enterPlay();
  }

  /** The running simulation while playing (handy from the browser console: `game.sim`). */
  get sim() {
    return this.#playMode?.sim ?? null;
  }

  get editor() {
    return this.#editor;
  }

  start() {
    this.#loop.start();
  }

  // ---- modes -------------------------------------------------------------

  #activate(mode, name) {
    this.#mode?.exit();
    this.#mode = mode;
    document.body.dataset.mode = name;
    this.#input.reset();
    mode.enter();
    mode.resize();
  }

  #enterEditor() {
    this.#activate(this.#editorMode, 'editor');
    this.#playMode = null;
  }

  /** Play the map being edited. Stays in the editor, with a message, if it cannot be played. */
  #enterPlay() {
    const editor = this.#editor;
    const blocking = editor.lint().find((issue) => issue.severity === 'error');
    if (blocking) {
      editor.setMessage(blocking.message, 'error');
      return;
    }

    try {
      this.#playMode = new PlayMode({
        canvas: this.#canvas,
        camera: this.#camera,
        input: this.#input,
        hudElement: this.#hudElement,
        screensElement: this.#screensElement,
        map: structuredClone(editor.map),
        seed: (Math.random() * 2 ** 32) >>> 0,
        debugFlags: this.#debugFlags,
        onEditor: () => this.#enterEditor(),
      });
    } catch (error) {
      editor.setMessage(`Cannot play this map: ${error.message}`, 'error');
      return;
    }
    this.#activate(this.#playMode, 'play');
  }

  #onKeyDown(event) {
    if (event.code !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
    event.preventDefault();
    if (event.repeat) return;
    if (this.#mode === this.#editorMode) this.#enterPlay();
    else this.#enterEditor();
  }

  // ---- maps --------------------------------------------------------------

  #save() {
    this.#storage.download(this.#editor.map);
    this.#editor.markSaved();
  }

  #confirmDiscard() {
    return !this.#editor.dirty || window.confirm('Discard the unsaved changes to this map?');
  }

  #newMap() {
    if (this.#confirmDiscard()) this.#editor.newMap();
  }

  async #openFile(file) {
    if (!this.#confirmDiscard()) return;
    const result = await this.#storage.readFile(file);
    if (result.ok) this.#editor.loadMap(result.map);
    else this.#editor.setMessage(`Cannot open ${file.name}: ${result.errors[0]}`, 'error');
  }

  async #openSample(fileName) {
    if (!this.#confirmDiscard()) return;
    try {
      this.#editor.loadMap(await this.#storage.fetchSample(fileName));
    } catch (error) {
      this.#editor.setMessage(error.message, 'error');
    }
  }

  #scheduleAutosave() {
    clearTimeout(this.#autosaveTimer);
    this.#autosaveTimer = setTimeout(() => this.#storage.saveAutosave(this.#editor.map), AUTOSAVE_DELAY_MS);
  }
}
