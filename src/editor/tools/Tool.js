/**
 * Base class for editor tools. A tool turns pointer events (in world
 * coordinates, with modifiers { shift, alt }) into commands on the editor.
 * The view only needs `cursor` and `preview()`.
 *
 * preview() returns what to draw as a ghost while the tool is working, or null:
 *   { kind: 'rect',   x, y, w, h, height }
 *   { kind: 'circle', cx, cy, r, height }
 *   { kind: 'marker', team, x, y, angle, radius }
 */
export class Tool {
  /** CSS cursor while this tool is active. */
  cursor = 'default';

  constructor(editor) {
    this.editor = editor;
  }

  onPointerDown() {}
  onPointerMove() {}
  onPointerUp() {}

  /** Abandon anything in progress without changing the map. */
  cancel() {}

  /** Is the tool in the middle of something Escape should cancel? */
  isBusy() {
    return false;
  }

  preview() {
    return null;
  }
}
