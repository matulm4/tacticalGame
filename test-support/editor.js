// Helpers for editor tests: build an EditorState and drive it with synthetic pointer events.
import { EditorState } from '../src/editor/EditorState.js';
import { makeMap } from './sim.js';

/** An editor on a 1000x800 map with the player start at (100, 400) unless overridden. */
export function makeEditor(options = {}) {
  return new EditorState(makeMap(options));
}

export const at = (x, y) => ({ x, y });

/** Press at `from`, move halfway, release at `to`. */
export function drag(editor, from, to, mods = {}) {
  editor.pointerDown(from, mods);
  editor.pointerMove({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, mods);
  editor.pointerMove(to, mods);
  editor.pointerUp(to, mods);
}

export function click(editor, point, mods = {}) {
  editor.pointerDown(point, mods);
  editor.pointerUp(point, mods);
}

export const obstacle = (editor, id) => editor.map.obstacles.find((o) => o.id === id);
export const spawnOf = (editor, id) => editor.map.spawns.find((s) => s.id === id);
