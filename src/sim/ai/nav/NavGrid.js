import { clamp } from '../../../core/math.js';
import { PriorityQueue } from '../../../core/priorityQueue.js';
import { NAV_CELL_SIZE, NAV_CLEARANCE } from '../../defs/tuning.js';
import { smoothPath } from './pathSmoothing.js';

const DIAGONAL = Math.SQRT2;
const NEIGHBORS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, DIAGONAL],
  [1, -1, DIAGONAL],
  [-1, 1, DIAGONAL],
  [-1, -1, DIAGONAL],
];

/**
 * The map as a grid for path finding. A cell is blocked when an agent standing
 * at its center would not fit (so paths keep clear of walls and map edges).
 * Built once per map, since the level geometry never changes during play.
 */
export class NavGrid {
  /** @param {import('../../map/StaticWorld.js').StaticWorld} staticWorld */
  constructor(staticWorld, { cellSize = NAV_CELL_SIZE, clearance = NAV_CLEARANCE } = {}) {
    this.world = staticWorld;
    this.cellSize = cellSize;
    this.clearance = clearance;
    this.cols = Math.ceil(staticWorld.width / cellSize);
    this.rows = Math.ceil(staticWorld.height / cellSize);
    this.blocked = new Uint8Array(this.cols * this.rows);

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const { x, y } = this.center(col, row);
        if (!staticWorld.circleFits(x, y, clearance)) this.blocked[row * this.cols + col] = 1;
      }
    }
  }

  center(col, row) {
    return { x: (col + 0.5) * this.cellSize, y: (row + 0.5) * this.cellSize };
  }

  cellOf(x, y) {
    return {
      col: clamp(Math.floor(x / this.cellSize), 0, this.cols - 1),
      row: clamp(Math.floor(y / this.cellSize), 0, this.rows - 1),
    };
  }

  isBlocked(col, row) {
    return col < 0 || row < 0 || col >= this.cols || row >= this.rows || this.blocked[row * this.cols + col] === 1;
  }

  /** The closest free cell to (col, row), searching outward ring by ring. */
  nearestFree(col, row, maxRing = 8) {
    if (!this.isBlocked(col, row)) return { col, row };
    for (let ring = 1; ring <= maxRing; ring++) {
      let best = null;
      let bestDistance = Infinity;
      for (let dRow = -ring; dRow <= ring; dRow++) {
        for (let dCol = -ring; dCol <= ring; dCol++) {
          if (Math.max(Math.abs(dCol), Math.abs(dRow)) !== ring || this.isBlocked(col + dCol, row + dRow)) continue;
          const distance = dCol * dCol + dRow * dRow;
          if (distance < bestDistance) {
            best = { col: col + dCol, row: row + dRow };
            bestDistance = distance;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Can an agent walk the straight line from A to B without touching a wall? */
  clearLine(ax, ay, bx, by) {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (this.cellSize / 2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.world.circleFits(ax + (bx - ax) * t, ay + (by - ay) * t, this.clearance)) return false;
    }
    return true;
  }

  /**
   * A walkable route from one point to another, as waypoints (the first is
   * `from`, the last is `to`, or the nearest reachable spot if `to` is inside
   * a wall). Null when there is no route.
   */
  findPath(from, to) {
    const startCell = this.cellOf(from.x, from.y);
    const goalCell = this.cellOf(to.x, to.y);
    const start = this.nearestFree(startCell.col, startCell.row);
    const goal = this.nearestFree(goalCell.col, goalCell.row);
    if (!start || !goal) return null;

    const cells = this.#search(start, goal);
    if (!cells) return null;

    const points = cells.map(({ col, row }) => this.center(col, row));
    points[0] = { x: from.x, y: from.y };
    const goalIsReachable = !this.isBlocked(goalCell.col, goalCell.row);
    points[points.length - 1] = goalIsReachable ? { x: to.x, y: to.y } : points.at(-1);
    if (points.length === 1) points.push(points[0]);

    return smoothPath(points, (a, b) => this.clearLine(a.x, a.y, b.x, b.y));
  }

  /** A* over free cells; no cutting corners diagonally. */
  #search(start, goal) {
    const { cols } = this;
    const startId = start.row * cols + start.col;
    const goalId = goal.row * cols + goal.col;

    const cost = new Float32Array(this.blocked.length).fill(Infinity);
    const cameFrom = new Int32Array(this.blocked.length).fill(-1);
    const heuristic = (col, row) => {
      const dx = Math.abs(col - goal.col);
      const dy = Math.abs(row - goal.row);
      return Math.max(dx, dy) + (DIAGONAL - 1) * Math.min(dx, dy);
    };

    const open = new PriorityQueue();
    cost[startId] = 0;
    open.push(startId, heuristic(start.col, start.row));

    while (open.size > 0) {
      const id = open.pop();
      if (id === goalId) return this.#cellsOf(cameFrom, id);

      const col = id % cols;
      const row = (id - col) / cols;
      for (const [dCol, dRow, step] of NEIGHBORS) {
        const nextCol = col + dCol;
        const nextRow = row + dRow;
        if (this.isBlocked(nextCol, nextRow)) continue;
        if (dCol !== 0 && dRow !== 0 && (this.isBlocked(col + dCol, row) || this.isBlocked(col, row + dRow))) continue;

        const nextId = nextRow * cols + nextCol;
        const nextCost = cost[id] + step;
        if (nextCost >= cost[nextId]) continue;
        cost[nextId] = nextCost;
        cameFrom[nextId] = id;
        open.push(nextId, nextCost + heuristic(nextCol, nextRow));
      }
    }
    return null;
  }

  #cellsOf(cameFrom, goalId) {
    const cells = [];
    for (let id = goalId; id !== -1; id = cameFrom[id]) {
      const col = id % this.cols;
      cells.push({ col, row: (id - col) / this.cols });
    }
    return cells.reverse();
  }
}
