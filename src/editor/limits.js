// Editor constants (world units unless noted).

export const MIN_RECT_SIZE = 10;
export const MIN_CIRCLE_RADIUS = 8;

/** How far an aim handle sits beyond the edge of a spawn marker. */
export const ANGLE_HANDLE_REACH = 26;
/** Dragging a spawn's aim handle with Shift held snaps to this step. */
export const ANGLE_SNAP_STEP = Math.PI / 12;

export const GRID_SIZES = Object.freeze([10, 20, 25, 50]);
export const DEFAULT_GRID_SIZE = 20;

/** Pointer tolerances in screen pixels; the editor converts them to world units. */
export const PICK_TOLERANCE_PX = 6;
export const HANDLE_TOLERANCE_PX = 9;

/** A pointer must travel this far (screen pixels) before it sets a spawn's direction. */
export const AIM_DEAD_ZONE_PX = 12;

export const HISTORY_LIMIT = 200;
