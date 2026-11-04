// Commands that change obstacles. Every command is {do(map), undo(map)}.

const find = (map, id) => map.obstacles.find((obstacle) => obstacle.id === id);

export class AddObstacle {
  constructor(obstacle) {
    this.obstacle = obstacle;
  }

  do(map) {
    map.obstacles.push({ ...this.obstacle });
  }

  undo(map) {
    map.obstacles.splice(map.obstacles.findIndex((obstacle) => obstacle.id === this.obstacle.id), 1);
  }
}

export class RemoveObstacle {
  constructor(id) {
    this.id = id;
    this.removed = null;
    this.index = -1;
  }

  do(map) {
    this.index = map.obstacles.findIndex((obstacle) => obstacle.id === this.id);
    [this.removed] = map.obstacles.splice(this.index, 1);
  }

  undo(map) {
    map.obstacles.splice(this.index, 0, this.removed);
  }
}

/**
 * Moves or resizes an obstacle. `before` and `after` are geometry snapshots
 * ({ x, y, w, h } or { cx, cy, r }). A drag creates the command once, then
 * calls setAfter() + do() as the pointer moves.
 */
export class SetObstacleGeometry {
  constructor(id, before, after) {
    this.id = id;
    this.before = before;
    this.after = after;
  }

  setAfter(after) {
    this.after = after;
  }

  do(map) {
    Object.assign(find(map, this.id), this.after);
  }

  undo(map) {
    Object.assign(find(map, this.id), this.before);
  }
}

export class SetCoverHeight {
  constructor(id, before, after) {
    this.id = id;
    this.before = before;
    this.after = after;
  }

  do(map) {
    find(map, this.id).height = this.after;
  }

  undo(map) {
    find(map, this.id).height = this.before;
  }
}
