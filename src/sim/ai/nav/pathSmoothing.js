/**
 * Straightens a grid path: from each waypoint, jump straight to the farthest
 * later waypoint that can be reached in a clear line (string pulling). A grid
 * path zig-zags in 8 directions; this makes it walk like a person.
 *
 * @param {{ x: number, y: number }[]} points
 * @param {(a: object, b: object) => boolean} isClear  can an agent walk straight from a to b?
 */
export function smoothPath(points, isClear) {
  if (points.length <= 2) return points;

  const smoothed = [points[0]];
  let from = 0;
  while (from < points.length - 1) {
    let to = points.length - 1;
    while (to > from + 1 && !isClear(points[from], points[to])) to--;
    smoothed.push(points[to]);
    from = to;
  }
  return smoothed;
}
