import { clamp } from '../../core/math.js';
import { ANGLE_SNAP_STEP, AIM_DEAD_ZONE_PX } from '../limits.js';
import { snapAngle } from '../snap.js';
import { Tool } from './Tool.js';

/**
 * Shared behavior of the player-start and enemy-spawn tools: click to place a
 * marker, drag before releasing to set the direction it faces (Shift snaps the
 * direction, Alt turns position snapping off). Subclasses say what a placement
 * means by implementing commit({ x, y, angle }).
 *
 * Subclass contract: `team` ('player' | 'enemy'), radius(), commit(spot).
 */
export class PlacementTool extends Tool {
  cursor = 'crosshair';
  #anchor = null;
  #hover = null;
  #angle = 0;

  onPointerDown(point, mods) {
    this.#anchor = this.#snapped(point, mods);
    this.#hover = this.#anchor;
    this.#angle = 0;
  }

  onPointerMove(point, mods) {
    if (!this.#anchor) {
      this.#hover = this.#snapped(point, mods);
      return;
    }
    const dx = point.x - this.#anchor.x;
    const dy = point.y - this.#anchor.y;
    if (Math.hypot(dx, dy) < AIM_DEAD_ZONE_PX * this.editor.pixelSize) return;
    const angle = Math.atan2(dy, dx);
    this.#angle = mods.shift ? snapAngle(angle, ANGLE_SNAP_STEP) : angle;
  }

  onPointerUp(point, mods) {
    if (!this.#anchor) return;
    this.onPointerMove(point, mods);
    const spot = { x: this.#anchor.x, y: this.#anchor.y, angle: this.#angle };
    this.cancel();
    this.commit(spot);
  }

  cancel() {
    this.#anchor = null;
  }

  isBusy() {
    return this.#anchor !== null;
  }

  preview() {
    const at = this.#anchor ?? this.#hover;
    if (!at) return null;
    return {
      kind: 'marker',
      team: this.team,
      x: at.x,
      y: at.y,
      angle: this.#anchor ? this.#angle : 0,
      radius: this.radius(),
    };
  }

  #snapped(point, mods) {
    const { map } = this.editor;
    const snapped = this.editor.snapPoint(point, mods);
    return { x: clamp(snapped.x, 0, map.width), y: clamp(snapped.y, 0, map.height) };
  }
}
