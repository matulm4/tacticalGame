import { geometryCommand } from '../commands/index.js';
import { hitHandle, hitTest } from '../hitTest.js';
import { ANGLE_SNAP_STEP } from '../limits.js';
import { snapAngle } from '../snap.js';
import { geometryOf, movedGeometry, resizedCircle, resizedRect, sameGeometry } from '../transform.js';
import { Tool } from './Tool.js';

/**
 * Click to select; drag the item to move it, drag a handle to resize a
 * rectangle / circle or to turn a spawn. The map is changed live while
 * dragging, and the whole drag is recorded as ONE undo step on release.
 * Alt turns snapping off, Shift snaps a spawn's direction.
 */
export class SelectTool extends Tool {
  id = 'select';
  #drag = null;

  onPointerDown(point) {
    const editor = this.editor;

    const selected = editor.selectedItem();
    if (selected) {
      const handle = hitHandle(selected, point.x, point.y, editor.handleTolerance());
      if (handle) {
        this.#begin(selected, handle === 'angle' ? 'angle' : 'resize', handle, point);
        return;
      }
    }

    const hit = hitTest(editor.map, point.x, point.y, editor.pickTolerance());
    editor.select(hit);
    if (hit) this.#begin(editor.selectedItem(), 'move', null, point);
  }

  onPointerMove(point, mods) {
    const drag = this.#drag;
    if (!drag) return;

    const editor = this.editor;
    const after = this.#target(drag, point, mods, editor.snapper(mods));
    if (sameGeometry(after, drag.command.after)) return;

    drag.command.setAfter(after);
    drag.command.do(editor.map);
    drag.moved = true;
    editor.changed();
  }

  onPointerUp(point, mods) {
    const drag = this.#drag;
    if (!drag) return;
    this.onPointerMove(point, mods);
    this.#drag = null;
    if (drag.moved) this.editor.record(drag.command);
  }

  /** Undo a drag in progress (Escape). */
  cancel() {
    const drag = this.#drag;
    this.#drag = null;
    if (drag?.moved) {
      drag.command.undo(this.editor.map);
      this.editor.changed();
    }
  }

  isBusy() {
    return this.#drag?.moved === true;
  }

  #begin(item, type, handle, point) {
    const origin = geometryOf(item);
    this.#drag = {
      type,
      handle,
      item,
      origin,
      grab: point,
      command: geometryCommand(item, origin, origin),
      moved: false,
    };
  }

  #target({ type, handle, item, origin, grab }, point, mods, snap) {
    const map = this.editor.map;

    if (type === 'move') return movedGeometry(item, origin, point.x - grab.x, point.y - grab.y, map, snap);

    if (type === 'angle') {
      const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
      return { ...origin, angle: mods.shift ? snapAngle(angle, ANGLE_SNAP_STEP) : angle };
    }

    return item.data.shape === 'rect'
      ? resizedRect(origin, handle, point, map, snap)
      : resizedCircle(origin, point, snap);
  }
}
