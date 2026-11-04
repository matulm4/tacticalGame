import { SetObstacleGeometry } from './obstacleCommands.js';
import { SetPlayerStart, SetSpawn } from './spawnCommands.js';

export { AddObstacle, RemoveObstacle, SetCoverHeight, SetObstacleGeometry } from './obstacleCommands.js';
export { AddSpawn, RemoveSpawn, SetPlayerStart, SetSpawn } from './spawnCommands.js';
export { ClearMap } from './ClearMap.js';

/**
 * The right "change geometry" command for a selected item
 * (`item` = { kind, id, data }, see EditorState.selectedItem()).
 */
export function geometryCommand(item, before, after) {
  if (item.kind === 'obstacle') return new SetObstacleGeometry(item.id, before, after);
  if (item.kind === 'spawn') return new SetSpawn(item.id, before, after);
  return new SetPlayerStart(before, after);
}
