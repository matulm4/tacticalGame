import { clamp } from '../../core/math.js';
import { AddObstacle } from '../commands/index.js';
import { MIN_RECT_SIZE } from '../limits.js';
import { Tool } from './Tool.js';

/** Drag to draw a rectangular obstacle. Shift makes it a square, Alt turns snapping off. */
export class RectTool extends Tool {
  id = 'rect';
  cursor = 'crosshair';
  #start = null;
  #current = null;

  onPointerDown(point, mods) {
    this.#start = this.#snapped(point, mods);
    this.#current = this.#start;
  }

  onPointerMove(point, mods) {
    if (!this.#start) return;
    this.#current = this.#snapped(point, mods);
    if (mods.shift) this.#current = this.#squared(this.#current);
  }

  onPointerUp(point, mods) {
    if (!this.#start) return;
    this.onPointerMove(point, mods);
    const rect = this.#rect();
    this.cancel();
    if (rect.w < MIN_RECT_SIZE || rect.h < MIN_RECT_SIZE) return;

    const editor = this.editor;
    const obstacle = { id: editor.nextId('o'), shape: 'rect', ...rect, height: editor.coverHeight };
    editor.execute(new AddObstacle(obstacle));
    editor.select({ kind: 'obstacle', id: obstacle.id });
  }

  cancel() {
    this.#start = null;
    this.#current = null;
  }

  isBusy() {
    return this.#start !== null;
  }

  preview() {
    if (!this.#start) return null;
    return { kind: 'rect', ...this.#rect(), height: this.editor.coverHeight };
  }

  #snapped(point, mods) {
    const { map } = this.editor;
    const snapped = this.editor.snapPoint(point, mods);
    return { x: clamp(snapped.x, 0, map.width), y: clamp(snapped.y, 0, map.height) };
  }

  /** Make the dragged box square, keeping the drag direction. */
  #squared(current) {
    const { map } = this.editor;
    const dx = current.x - this.#start.x;
    const dy = current.y - this.#start.y;
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      x: clamp(this.#start.x + Math.sign(dx || 1) * size, 0, map.width),
      y: clamp(this.#start.y + Math.sign(dy || 1) * size, 0, map.height),
    };
  }

  #rect() {
    const x = Math.min(this.#start.x, this.#current.x);
    const y = Math.min(this.#start.y, this.#current.y);
    return { x, y, w: Math.abs(this.#current.x - this.#start.x), h: Math.abs(this.#current.y - this.#start.y) };
  }
}
