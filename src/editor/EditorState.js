import { AGENT_TYPES } from '../sim/defs/agentTypes.js';
import { COVER_HEIGHTS } from '../sim/defs/coverHeights.js';
import { createEmptyMap } from '../sim/map/mapSchema.js';
import { History } from './History.js';
import {
  ClearMap,
  RemoveObstacle,
  RemoveSpawn,
  SetCoverHeight,
  SetPlayerStart,
  geometryCommand,
} from './commands/index.js';
import { HANDLE_TOLERANCE_PX, DEFAULT_GRID_SIZE, GRID_SIZES, PICK_TOLERANCE_PX } from './limits.js';
import { lintMap } from './mapLint.js';
import { snapValue } from './snap.js';
import { CircleTool } from './tools/CircleTool.js';
import { EnemySpawnTool } from './tools/EnemySpawnTool.js';
import { PlayerStartTool } from './tools/PlayerStartTool.js';
import { RectTool } from './tools/RectTool.js';
import { SelectTool } from './tools/SelectTool.js';
import { geometryOf, movedGeometry } from './transform.js';

/**
 * Everything about editing a map except drawing it: the working copy of the
 * map, selection, active tool, snapping, undo history. No DOM, so it is
 * driven by synthetic pointer events in the tests.
 *
 * Selection is { kind: 'obstacle' | 'spawn' | 'playerStart', id } or null.
 */
export class EditorState {
  #listeners = new Set();

  /** @param {object} map  a validated map (see sim/map/mapSchema.js) */
  constructor(map) {
    this.history = new History();
    this.tools = {
      select: new SelectTool(this),
      rect: new RectTool(this),
      circle: new CircleTool(this),
      playerStart: new PlayerStartTool(this),
      enemySpawn: new EnemySpawnTool(this),
    };

    this.toolId = 'select';
    this.coverHeight = 'high'; // height given to newly drawn obstacles
    this.spawnType = this.spawnTypes[0];
    this.snap = { enabled: true, size: DEFAULT_GRID_SIZE };
    this.pixelSize = 1; // world units per screen pixel, kept current by the view
    this.message = null; // { text, severity } shown by the toolbar

    this.map = null;
    this.selection = null;
    this.dirty = false;
    this.loadMap(map);
  }

  // ---- observing ---------------------------------------------------------

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Tell observers something changed (tools call this while dragging). */
  changed() {
    this.dirty = true;
    this.#notify();
  }

  #notify() {
    for (const listener of this.#listeners) listener(this);
  }

  // ---- the map -----------------------------------------------------------

  /** Replace the working map (opening a file, a sample, or starting fresh). */
  loadMap(map) {
    this.tool?.cancel();
    this.map = structuredClone(map);
    this.history.clear();
    this.selection = null;
    this.dirty = false;
    this.message = null;
    this.#notify();
  }

  newMap() {
    this.loadMap(createEmptyMap());
  }

  markSaved() {
    this.dirty = false;
    this.#notify();
  }

  setName(name) {
    this.map.name = name;
    this.changed();
  }

  lint() {
    return lintMap(this.map);
  }

  setMessage(text, severity = 'info') {
    this.message = text ? { text, severity } : null;
    this.#notify();
  }

  /** The next unused id such as 'o3' or 's2'. */
  nextId(prefix) {
    const used = new Set([...this.map.obstacles, ...this.map.spawns].map((item) => item.id));
    let n = 1;
    while (used.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  }

  // ---- history -----------------------------------------------------------

  /** Run a command and make it one undo step. */
  execute(command) {
    this.history.execute(command, this.map);
    this.#afterChange();
  }

  /** Record a command a tool already applied while dragging. */
  record(command) {
    this.history.record(command);
    this.#afterChange();
  }

  undo() {
    if (this.history.undo(this.map)) this.#afterChange();
  }

  redo() {
    if (this.history.redo(this.map)) this.#afterChange();
  }

  get canUndo() {
    return this.history.canUndo;
  }

  get canRedo() {
    return this.history.canRedo;
  }

  #afterChange() {
    this.dirty = true;
    this.message = null;
    if (!this.selectedItem()) this.selection = null;
    this.#notify();
  }

  // ---- tools and pointer -------------------------------------------------

  get tool() {
    return this.tools[this.toolId];
  }

  setTool(id) {
    if (!this.tools[id]) throw new Error(`Unknown tool "${id}"`);
    this.tool.cancel();
    this.toolId = id;
    this.#notify();
  }

  /** Enemy archetypes the spawn tool can place. */
  get spawnTypes() {
    return Object.values(AGENT_TYPES)
      .filter((type) => type.team !== 'player')
      .map((type) => type.id);
  }

  setSpawnType(type) {
    if (!this.spawnTypes.includes(type)) throw new Error(`Unknown enemy type "${type}"`);
    this.spawnType = type;
    this.#notify();
  }

  /** @param {{x: number, y: number}} point world coordinates  @param {{shift?: boolean, alt?: boolean}} [mods] */
  pointerDown(point, mods = {}) {
    this.tool.onPointerDown(point, mods);
    this.#notify();
  }

  pointerMove(point, mods = {}) {
    this.tool.onPointerMove(point, mods);
  }

  pointerUp(point, mods = {}) {
    this.tool.onPointerUp(point, mods);
    this.#notify();
  }

  /** Escape: abandon a drag, else clear the selection, else go back to Select. */
  escape() {
    if (this.tool.isBusy()) {
      this.tool.cancel();
      this.#notify();
    } else if (this.selection) {
      this.select(null);
    } else if (this.toolId !== 'select') {
      this.setTool('select');
    }
  }

  pickTolerance() {
    return PICK_TOLERANCE_PX * this.pixelSize;
  }

  handleTolerance() {
    return HANDLE_TOLERANCE_PX * this.pixelSize;
  }

  // ---- snapping ----------------------------------------------------------

  /** A function that snaps one coordinate; Alt (held) turns snapping off. */
  snapper(mods = {}) {
    const active = this.snap.enabled && !mods.alt;
    return (value) => (active ? snapValue(value, this.snap.size) : value);
  }

  snapPoint(point, mods = {}) {
    const snap = this.snapper(mods);
    return { x: snap(point.x), y: snap(point.y) };
  }

  setSnapEnabled(enabled) {
    this.snap.enabled = enabled;
    this.#notify();
  }

  toggleSnap() {
    this.setSnapEnabled(!this.snap.enabled);
  }

  setGridSize(size) {
    if (!GRID_SIZES.includes(size)) throw new Error(`Unsupported grid size ${size}`);
    this.snap.size = size;
    this.#notify();
  }

  // ---- selection ---------------------------------------------------------

  select(selection) {
    this.selection = selection ? { kind: selection.kind, id: selection.id } : null;
    this.#notify();
  }

  /** The selected thing as { kind, id, data } (data is the live map object), or null. */
  selectedItem() {
    const selection = this.selection;
    if (!selection) return null;

    let data = null;
    if (selection.kind === 'obstacle') data = this.map.obstacles.find((o) => o.id === selection.id);
    else if (selection.kind === 'spawn') data = this.map.spawns.find((s) => s.id === selection.id);
    else if (selection.kind === 'playerStart') data = this.map.playerStart;

    return data ? { kind: selection.kind, id: selection.id, data } : null;
  }

  deleteSelection() {
    const item = this.selectedItem();
    if (!item) return;

    if (item.kind === 'obstacle') this.execute(new RemoveObstacle(item.id));
    else if (item.kind === 'spawn') this.execute(new RemoveSpawn(item.id));
    else this.execute(new SetPlayerStart({ ...item.data }, null));
  }

  /** Move the selection by whole grid steps (arrow keys). */
  nudgeSelection(stepsX, stepsY) {
    const item = this.selectedItem();
    if (!item) return;

    const step = this.snap.enabled ? this.snap.size : 1;
    const before = geometryOf(item);
    const after = movedGeometry(item, before, stepsX * step, stepsY * step, this.map, (value) => value);
    this.execute(geometryCommand(item, before, after));
  }

  // ---- cover height ------------------------------------------------------

  /** The height shown as active: the selected obstacle's, else the default for new ones. */
  activeCoverHeight() {
    const item = this.selectedItem();
    return item?.kind === 'obstacle' ? item.data.height : this.coverHeight;
  }

  /** Sets the height for new obstacles and, if an obstacle is selected, changes that one too. */
  setCoverHeight(height) {
    if (!(height in COVER_HEIGHTS)) throw new Error(`Unknown cover height "${height}"`);
    this.coverHeight = height;

    const item = this.selectedItem();
    if (item?.kind === 'obstacle' && item.data.height !== height) {
      this.execute(new SetCoverHeight(item.id, item.data.height, height));
    } else {
      this.#notify();
    }
  }

  toggleCoverHeight() {
    this.setCoverHeight(this.activeCoverHeight() === 'high' ? 'low' : 'high');
  }

  clearMap() {
    this.execute(new ClearMap());
  }
}
