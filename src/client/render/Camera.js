// World <-> screen transform, in CSS pixels (device pixel ratio is the renderer's job).
//
// Two modes:
//   fit     the whole map, letterboxed and centered (the editor)
//   follow  a close-up that keeps a point (the player) centered and shows only
//           `visibleHeight` world units vertically; the view stops at the map
//           edges, and a map smaller than the view is simply centered
//
// screen = world * scale + offset

import { clamp } from '../../core/math.js';

export class Camera {
  /**
   * @param {object} options
   * @param {number} options.worldWidth
   * @param {number} options.worldHeight
   * @param {number} [options.padding=16]        margin around the map in fit mode (CSS pixels)
   * @param {number} [options.visibleHeight=560] world units visible vertically in follow mode
   */
  constructor({ worldWidth, worldHeight, padding = 16, visibleHeight = 560 }) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.padding = padding;
    this.visibleHeight = visibleHeight;

    this.mode = 'fit';
    this.centerX = worldWidth / 2;
    this.centerY = worldHeight / 2;

    this.viewWidth = 0;
    this.viewHeight = 0;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  setWorldSize(worldWidth, worldHeight) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.#update();
  }

  resize(viewWidth, viewHeight) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.#update();
  }

  /** Show the whole map. */
  fitToWorld() {
    this.mode = 'fit';
    this.#update();
  }

  /** Close-up centered on (x, y). Call every frame with the target's position. */
  follow(x, y) {
    this.mode = 'follow';
    this.centerX = x;
    this.centerY = y;
    this.#update();
  }

  worldToScreen(x, y) {
    return { x: x * this.scale + this.offsetX, y: y * this.scale + this.offsetY };
  }

  screenToWorld(x, y) {
    return { x: (x - this.offsetX) / this.scale, y: (y - this.offsetY) / this.scale };
  }

  #update() {
    if (this.mode === 'follow') this.#updateFollow();
    else this.#updateFit();
  }

  #updateFit() {
    const availableWidth = Math.max(this.viewWidth - 2 * this.padding, 1);
    const availableHeight = Math.max(this.viewHeight - 2 * this.padding, 1);
    this.scale = Math.min(availableWidth / this.worldWidth, availableHeight / this.worldHeight);
    this.offsetX = (this.viewWidth - this.worldWidth * this.scale) / 2;
    this.offsetY = (this.viewHeight - this.worldHeight * this.scale) / 2;
  }

  #updateFollow() {
    if (this.viewHeight <= 0) return; // not sized yet
    this.scale = this.viewHeight / this.visibleHeight;
    const centerX = this.#clampCenter(this.centerX, this.viewWidth, this.worldWidth);
    const centerY = this.#clampCenter(this.centerY, this.viewHeight, this.worldHeight);
    this.offsetX = this.viewWidth / 2 - centerX * this.scale;
    this.offsetY = this.viewHeight / 2 - centerY * this.scale;
  }

  /** Keep the view inside the map; center the map on an axis where it is smaller than the view. */
  #clampCenter(center, viewPixels, worldSize) {
    const half = viewPixels / this.scale / 2;
    return worldSize <= 2 * half ? worldSize / 2 : clamp(center, half, worldSize - half);
  }
}
