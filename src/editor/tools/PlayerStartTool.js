import { AGENT_TYPES } from '../../sim/defs/agentTypes.js';
import { SetPlayerStart } from '../commands/index.js';
import { PlacementTool } from './PlacementTool.js';

/** Places (or moves) the single player start. */
export class PlayerStartTool extends PlacementTool {
  id = 'playerStart';
  team = 'player';

  radius() {
    return AGENT_TYPES.player.radius;
  }

  commit(spot) {
    const { editor } = this;
    const before = editor.map.playerStart ? { ...editor.map.playerStart } : null;
    editor.execute(new SetPlayerStart(before, spot));
    editor.select({ kind: 'playerStart', id: 'playerStart' });
  }
}
