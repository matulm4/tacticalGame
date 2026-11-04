// Picking and handles. "Item" means { kind, id, data }:
//   kind 'obstacle'    data = a map obstacle
//   kind 'spawn'       data = a map enemy spawn
//   kind 'playerStart' data = map.playerStart (id is always 'playerStart')

import { AGENT_TYPES } from '../sim/defs/agentTypes.js';
import { ANGLE_HANDLE_REACH } from './limits.js';

const DEFAULT_MARKER_RADIUS = 18;

/** Radius of the circle drawn for a spawn marker. */
export function markerRadius(kind, data) {
  if (kind === 'playerStart') return AGENT_TYPES.player.radius;
  return AGENT_TYPES[data.type]?.radius ?? DEFAULT_MARKER_RADIUS;
}

function containsPoint(obstacle, x, y, tolerance) {
  if (obstacle.shape === 'rect') {
    return (
      x >= obstacle.x - tolerance &&
      x <= obstacle.x + obstacle.w + tolerance &&
      y >= obstacle.y - tolerance &&
      y <= obstacle.y + obstacle.h + tolerance
    );
  }
  return Math.hypot(x - obstacle.cx, y - obstacle.cy) <= obstacle.r + tolerance;
}

/**
 * What is under the pointer? Markers are drawn on top of obstacles, and later
 * items on top of earlier ones, so they win in that order.
 * @returns {{ kind: string, id: string } | null}
 */
export function hitTest(map, x, y, tolerance) {
  for (let i = map.spawns.length - 1; i >= 0; i--) {
    const spawn = map.spawns[i];
    if (Math.hypot(x - spawn.x, y - spawn.y) <= markerRadius('spawn', spawn) + tolerance) {
      return { kind: 'spawn', id: spawn.id };
    }
  }

  const start = map.playerStart;
  if (start && Math.hypot(x - start.x, y - start.y) <= markerRadius('playerStart', start) + tolerance) {
    return { kind: 'playerStart', id: 'playerStart' };
  }

  for (let i = map.obstacles.length - 1; i >= 0; i--) {
    if (containsPoint(map.obstacles[i], x, y, tolerance)) return { kind: 'obstacle', id: map.obstacles[i].id };
  }
  return null;
}

/**
 * Drag handles of a selected item, corners before edges so they win when they overlap.
 * Rectangles: nw ne se sw n e s w. Circles: r. Markers: angle.
 * @returns {{ id: string, x: number, y: number }[]}
 */
export function handlePoints(item) {
  const { kind, data } = item;

  if (kind !== 'obstacle') {
    const reach = markerRadius(kind, data) + ANGLE_HANDLE_REACH;
    return [{ id: 'angle', x: data.x + Math.cos(data.angle) * reach, y: data.y + Math.sin(data.angle) * reach }];
  }

  if (data.shape === 'circle') return [{ id: 'r', x: data.cx + data.r, y: data.cy }];

  const { x, y, w, h } = data;
  return [
    { id: 'nw', x, y },
    { id: 'ne', x: x + w, y },
    { id: 'se', x: x + w, y: y + h },
    { id: 'sw', x, y: y + h },
    { id: 'n', x: x + w / 2, y },
    { id: 'e', x: x + w, y: y + h / 2 },
    { id: 's', x: x + w / 2, y: y + h },
    { id: 'w', x, y: y + h / 2 },
  ];
}

/** The handle id under the pointer, or null. */
export function hitHandle(item, x, y, tolerance) {
  for (const handle of handlePoints(item)) {
    if (Math.hypot(x - handle.x, y - handle.y) <= tolerance) return handle.id;
  }
  return null;
}
