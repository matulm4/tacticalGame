import { COVER_HEIGHTS } from '../defs/coverHeights.js';

/**
 * The one place that decides whether an obstacle stops a segment (a line of
 * sight or a bullet's path). Sight and bullets both call it.
 *
 * - high obstacles always block.
 * - low obstacles block if either end of the segment is crouched: standing
 *   agents see and shoot over them, anyone crouched is hidden behind them and
 *   cannot see or shoot over them.
 * - blind fire is the exception: the shooter holds the gun over the top, so a
 *   blind shot is treated as coming from a standing shooter. The target's own
 *   crouch still counts.
 *
 * @param {string} height  'high' | 'low'
 * @param {object} [ends]
 * @param {boolean} [ends.sourceCrouched]  shooter / observer is crouched
 * @param {boolean} [ends.targetCrouched]  victim / observed agent is crouched
 * @param {boolean} [ends.blind]           the shot is blind fire
 */
export function obstacleBlocks(height, { sourceCrouched = false, targetCrouched = false, blind = false } = {}) {
  const def = COVER_HEIGHTS[height];
  if (!def) throw new Error(`Unknown cover height "${height}"`);
  if (def.blocks === 'always') return true;
  return (sourceCrouched && !blind) || targetCrouched;
}
