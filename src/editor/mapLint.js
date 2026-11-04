import { AGENT_TYPES } from '../sim/defs/agentTypes.js';
import { StaticWorld } from '../sim/map/StaticWorld.js';

/**
 * Problems with a map, for the editor to show.
 * 'error' blocks playing it; 'warning' is only a heads-up.
 * (Unreachable spawns are checked once pathfinding exists.)
 * @returns {{ severity: 'error' | 'warning', message: string, target?: { kind: string, id: string } }[]}
 */
export function lintMap(map) {
  const issues = [];
  const world = new StaticWorld(map);

  if (!map.playerStart) {
    issues.push({ severity: 'error', message: 'No player start: place one to play this map.' });
  } else if (!world.circleFits(map.playerStart.x, map.playerStart.y, AGENT_TYPES.player.radius)) {
    issues.push({
      severity: 'warning',
      message: 'The player start is inside a wall or outside the map.',
      target: { kind: 'playerStart', id: 'playerStart' },
    });
  }

  if (map.spawns.length === 0) {
    issues.push({ severity: 'warning', message: 'No enemy spawns yet.' });
  }

  for (const spawn of map.spawns) {
    const def = AGENT_TYPES[spawn.type];
    const target = { kind: 'spawn', id: spawn.id };
    if (!def) {
      issues.push({ severity: 'error', message: `Spawn ${spawn.id} has an unknown type "${spawn.type}".`, target });
    } else if (!world.circleFits(spawn.x, spawn.y, def.radius)) {
      issues.push({ severity: 'warning', message: `Spawn ${spawn.id} is inside a wall or outside the map.`, target });
    }
  }

  return issues;
}
