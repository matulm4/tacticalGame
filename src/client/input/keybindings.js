// Action -> keys. Keys are KeyboardEvent.code values, which name the physical
// key, so holding Shift (crouch) does not change which movement key is read.
// A rebinding UI only has to edit this table.

export const KEY_BINDINGS = Object.freeze({
  moveUp: ['KeyW'],
  moveDown: ['KeyS'],
  moveLeft: ['KeyA'],
  moveRight: ['KeyD'],
  reload: ['KeyR'],
  crouch: ['ShiftLeft', 'ShiftRight'],
  toggleVision: ['KeyV'], // debug overlay: enemy view cones
  toggleNoise: ['KeyN'], // debug overlay: sound rings
  togglePlan: ['KeyP'], // debug overlay: what each enemy wants and plans to do
  toggleCover: ['KeyC'], // debug overlay: cover positions
  toggleSquads: ['KeyQ'], // debug overlay: squads, their orders and what they know
  restart: ['Enter'], // after the match has ended
});

/** Mouse button that fires (0 = left). */
export const FIRE_BUTTON = 0;
