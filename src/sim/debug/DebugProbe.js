// Read-only snapshots of AI internals, computed on demand for the debug
// overlays. The client only calls these while an overlay is switched on, so
// they cost nothing otherwise, and the picture always matches what the AI uses.

import { DEG } from '../../core/math.js';
import { isValidCover } from '../ai/cover/CoverQuery.js';
import { visionPolygon } from '../ai/perception/visionPolygon.js';

/**
 * Every cover position on the map, and whether it would hide an agent standing
 * there from the player (the usual threat).
 */
export function coverNodes(world) {
  const player = world.player;
  return world.cover.nodes.map((node) => ({
    x: node.x,
    y: node.y,
    height: node.height,
    hidesFromPlayer: player ? isValidCover(world, node, player) : false,
  }));
}

/**
 * What every living AI agent is up to: its goal, the plan and which step it is
 * on, which Goto/Animate state it is in, the path it follows, and what it
 * knows about its target. (Positions are copied so the overlay cannot alter them.)
 */
export function aiInfo(world) {
  return world.agents
    .filter((agent) => agent.alive && agent.controller?.debugInfo)
    .map((agent) => ({ agentId: agent.id, x: agent.x, y: agent.y, ...agent.controller.debugInfo() }));
}

/**
 * Every squad: who is in it, what behavior it is running, what each member has
 * been ordered to do, and what it jointly knows about the enemy.
 */
export function squadInfo(world) {
  return world.squads.squads.map((squad) => ({
    squadId: squad.id,
    team: squad.team,
    behavior: squad.behavior?.id ?? null,
    sighting: squad.blackboard.sighting ? { ...squad.blackboard.sighting } : null,
    members: squad.members.map((agent) => ({
      agentId: agent.id,
      x: agent.x,
      y: agent.y,
      order: agent.controller.brain.memory.activeOrder(world.time)?.type ?? null,
    })),
  }));
}

/**
 * The view cone of every living agent that can see.
 * `polygon` is the visible area for a standing target; `crouchedRange` is how
 * far a crouched target can be seen.
 */
export function visionCones(world) {
  return world.agents
    .filter((agent) => agent.alive && agent.def.vision)
    .map((agent) => {
      const { fovDeg, range, crouchRangeMult } = agent.def.vision;
      return {
        agentId: agent.id,
        x: agent.x,
        y: agent.y,
        aimAngle: agent.aimAngle,
        halfFov: (fovDeg * DEG) / 2,
        range,
        crouchedRange: range * crouchRangeMult,
        polygon: visionPolygon(world, agent),
      };
    });
}
