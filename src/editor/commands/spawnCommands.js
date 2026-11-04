// Commands that change the player start and enemy spawns. Every command is {do(map), undo(map)}.

const find = (map, id) => map.spawns.find((spawn) => spawn.id === id);

/** `before` / `after` are { x, y, angle } objects, or null for "no player start". */
export class SetPlayerStart {
  constructor(before, after) {
    this.before = before;
    this.after = after;
  }

  setAfter(after) {
    this.after = after;
  }

  do(map) {
    map.playerStart = this.after ? { ...this.after } : null;
  }

  undo(map) {
    map.playerStart = this.before ? { ...this.before } : null;
  }
}

export class AddSpawn {
  constructor(spawn) {
    this.spawn = spawn;
  }

  do(map) {
    map.spawns.push({ ...this.spawn });
  }

  undo(map) {
    map.spawns.splice(map.spawns.findIndex((spawn) => spawn.id === this.spawn.id), 1);
  }
}

export class RemoveSpawn {
  constructor(id) {
    this.id = id;
    this.removed = null;
    this.index = -1;
  }

  do(map) {
    this.index = map.spawns.findIndex((spawn) => spawn.id === this.id);
    [this.removed] = map.spawns.splice(this.index, 1);
  }

  undo(map) {
    map.spawns.splice(this.index, 0, this.removed);
  }
}

/** Moves / turns a spawn. `before` and `after` are { x, y, angle } snapshots. */
export class SetSpawn {
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
