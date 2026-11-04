import { AGENT_TYPES } from '../../sim/defs/agentTypes.js';
import { AddSpawn } from '../commands/index.js';
import { PlacementTool } from './PlacementTool.js';

/** Adds an enemy spawn of the editor's current enemy type. */
export class EnemySpawnTool extends PlacementTool {
  id = 'enemySpawn';
  team = 'enemy';

  radius() {
    return AGENT_TYPES[this.editor.spawnType].radius;
  }

  commit(spot) {
    const { editor } = this;
    const type = editor.spawnType;
    const spawn = { id: editor.nextId('s'), type, team: AGENT_TYPES[type].team, ...spot };
    editor.execute(new AddSpawn(spawn));
    editor.select({ kind: 'spawn', id: spawn.id });
  }
}
