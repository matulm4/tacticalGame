/**
 * Owns the canvas context and draws layers back to front.
 * Read-only with respect to the game: it is handed a scene and draws it.
 * Each layer implements draw(ctx, frame), frame = { scene, theme, camera, alpha }.
 */
export class Renderer {
  #canvas;
  #ctx;
  #camera;
  #theme;
  #layers;
  #dpr = 1;

  constructor(canvas, camera, theme, layers) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this.#camera = camera;
    this.#theme = theme;
    this.#layers = layers;
  }

  /** Match the backing store to the CSS size and device pixel ratio. */
  resize() {
    this.#dpr = window.devicePixelRatio || 1;
    const cssWidth = this.#canvas.clientWidth;
    const cssHeight = this.#canvas.clientHeight;
    this.#canvas.width = Math.max(Math.round(cssWidth * this.#dpr), 1);
    this.#canvas.height = Math.max(Math.round(cssHeight * this.#dpr), 1);
    this.#camera.resize(cssWidth, cssHeight);
  }

  /**
   * @param {object} scene  what to draw (map, world, effects, ...)
   * @param {number} alpha  interpolation factor between the last two ticks
   */
  render(scene, alpha) {
    const ctx = this.#ctx;
    const camera = this.#camera;
    const dpr = this.#dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.#theme.colors.background;
    ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);

    ctx.setTransform(
      dpr * camera.scale, 0,
      0, dpr * camera.scale,
      dpr * camera.offsetX, dpr * camera.offsetY,
    );

    const frame = { scene, theme: this.#theme, camera, alpha };
    for (const layer of this.#layers) {
      ctx.save();
      layer.draw(ctx, frame);
      ctx.restore();
    }
  }
}
