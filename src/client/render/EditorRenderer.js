import { Renderer } from './Renderer.js';
import { EditorLayer } from './layers/EditorLayer.js';
import { TerrainLayer } from './layers/TerrainLayer.js';

/** Draws the map being edited: the normal terrain plus the editor layer on top. */
export class EditorRenderer {
  #renderer;

  constructor(canvas, camera, theme) {
    this.#renderer = new Renderer(canvas, camera, theme, [new TerrainLayer(), new EditorLayer()]);
  }

  resize() {
    this.#renderer.resize();
  }

  render(editor) {
    this.#renderer.render({ map: editor.map, editor }, 1);
  }
}
