import { clamp } from '../../core/math.js';
import { AddObstacle } from '../commands/index.js';
import { MIN_CIRCLE_RADIUS } from '../limits.js';
import { Tool } from './Tool.js';

/** Drag from the center outwards to draw a round obstacle. Alt turns snapping off. */
export class CircleTool extends Tool {
  id = 'circle';
  cursor = 'crosshair';
  #center = null;
  #radius = 0;

  onPointerDown(point, mods) {
    const { map } = this.editor;
    const snapped = this.editor.snapPoint(point, mods);
    this.#center = { x: clamp(snapped.x, 0, map.width), y: clamp(snapped.y, 0, map.height) };
    this.#radius = 0;
  }

  onPointerMove(point, mods) {
    if (!this.#center) return;
    const distance = Math.hypot(point.x - this.#center.x, point.y - this.#center.y);
    this.#radius = this.editor.snapper(mods)(distance);
  }

  onPointerUp(point, mods) {
    if (!this.#center) return;
    this.onPointerMove(point, mods);
    const { x: cx, y: cy } = this.#center;
    const r = this.#radius;
    this.cancel();
    if (r < MIN_CIRCLE_RADIUS) return;

    const editor = this.editor;
    const obstacle = { id: editor.nextId('o'), shape: 'circle', cx, cy, r, height: editor.coverHeight };
    editor.execute(new AddObstacle(obstacle));
    editor.select({ kind: 'obstacle', id: obstacle.id });
  }

  cancel() {
    this.#center = null;
    this.#radius = 0;
  }

  isBusy() {
    return this.#center !== null;
  }

  preview() {
    if (!this.#center) return null;
    return {
      kind: 'circle',
      cx: this.#center.x,
      cy: this.#center.y,
      r: Math.max(this.#radius, MIN_CIRCLE_RADIUS),
      height: this.editor.coverHeight,
    };
  }
}
