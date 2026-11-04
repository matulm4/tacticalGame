/**
 * Named places an agent can plan to be at (its post, a spot to investigate,
 * later cover positions). The planner's AtNode variable holds a node's handle:
 * a positive integer; 0 means "at no node".
 */
export class NodeRegistry {
  #nodes = [];
  #byKey = new Map();

  /** Like add(), but the same `key` always gives the same handle (so a node is only registered once). */
  addOnce(key, node) {
    if (!this.#byKey.has(key)) this.#byKey.set(key, this.add(node));
    return this.#byKey.get(key);
  }

  /**
   * @param {{ x: number, y: number, kind: string }} node  may carry extra data (cover nodes carry their `cover`)
   * @returns {number} the new node's handle
   */
  add(node) {
    this.#nodes.push({ ...node });
    return this.#nodes.length; // handles start at 1
  }

  get(handle) {
    return this.#nodes[handle - 1] ?? null;
  }

  /** The handle of the closest node within `radius` of (x, y), or 0. */
  nodeNear(x, y, radius) {
    let best = 0;
    let bestDistance = radius;
    this.#nodes.forEach((node, index) => {
      const distance = Math.hypot(node.x - x, node.y - y);
      if (distance <= bestDistance) {
        best = index + 1;
        bestDistance = distance;
      }
    });
    return best;
  }
}
