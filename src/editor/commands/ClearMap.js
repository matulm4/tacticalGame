/** Removes every obstacle, spawn and the player start (undoable). */
export class ClearMap {
  #snapshot = null;

  do(map) {
    this.#snapshot = structuredClone({
      obstacles: map.obstacles,
      playerStart: map.playerStart,
      spawns: map.spawns,
    });
    map.obstacles = [];
    map.playerStart = null;
    map.spawns = [];
  }

  undo(map) {
    const { obstacles, playerStart, spawns } = structuredClone(this.#snapshot);
    map.obstacles = obstacles;
    map.playerStart = playerStart;
    map.spawns = spawns;
  }
}
