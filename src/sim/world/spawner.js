import { createController } from '../controllers/index.js';
import { AGENT_TYPES } from '../defs/agentTypes.js';
import { createAgent } from '../entities/Agent.js';

/**
 * Creates the agents a map asks for: the player at the player start, and one
 * agent per enemy spawn, each driven by the controller its archetype names and
 * posted where it spawned.
 */
export function spawnAgents(world, map, playerController) {
  addAgent(world, AGENT_TYPES.player, map.playerStart, () => playerController);

  for (const spawn of map.spawns) {
    const def = AGENT_TYPES[spawn.type];
    if (!def) throw new Error(`Unknown agent type "${spawn.type}" in spawn "${spawn.id}"`);
    const agent = addAgent(world, def, spawn, (home) => createController(def.ai, { def, home }));
    agent.team = spawn.team;
  }
}

function addAgent(world, def, spot, makeController) {
  // A start placed inside a wall is pushed out rather than trapping the agent.
  const position = world.static.resolveCircle(spot.x, spot.y, def.radius);
  const controller = makeController({ x: position.x, y: position.y, angle: spot.angle });
  const agent = createAgent({
    id: world.nextId(),
    def,
    x: position.x,
    y: position.y,
    angle: spot.angle,
    controller,
  });

  world.addAgent(agent);
  if (def.team === 'player' && controller !== null) world.playerId = agent.id;
  world.emit('agentSpawned', { agentId: agent.id, typeId: def.id, team: agent.team, x: agent.x, y: agent.y });
  return agent;
}
