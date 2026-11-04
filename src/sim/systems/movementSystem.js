import { circleCirclePush } from '../../core/geometry.js';
import { FOOTSTEP_DISTANCE } from '../defs/tuning.js';
import { agentRadius } from '../entities/Agent.js';

/**
 * Moves agents (crouching slows them), slides them along walls, keeps them
 * inside the map, pushes overlapping agents apart, and emits footstep sounds.
 */
export function movementSystem(world, dt) {
  for (const agent of world.agents) {
    if (!agent.alive) {
      agent.speed = 0;
      continue;
    }

    const { def, intent } = agent;
    const maxSpeed = def.speed * (agent.crouched ? def.crouchSpeedMult : 1);
    const startX = agent.x;
    const startY = agent.y;

    const resolved = world.static.resolveCircle(
      startX + intent.moveX * maxSpeed * dt,
      startY + intent.moveY * maxSpeed * dt,
      agentRadius(agent),
    );
    agent.x = resolved.x;
    agent.y = resolved.y;

    const moved = Math.hypot(agent.x - startX, agent.y - startY);
    agent.speed = moved / dt;
    emitFootsteps(world, agent, moved);
  }

  separateAgents(world);
}

function emitFootsteps(world, agent, moved) {
  if (moved <= 0) return;
  const radius = agent.crouched ? agent.def.footstepNoise.crouch : agent.def.footstepNoise.walk;

  agent.stepDistance += moved;
  while (agent.stepDistance >= FOOTSTEP_DISTANCE) {
    agent.stepDistance -= FOOTSTEP_DISTANCE;
    if (radius > 0) {
      world.emitSound({
        kind: 'footstep',
        x: agent.x,
        y: agent.y,
        radius,
        sourceId: agent.id,
        team: agent.team,
      });
    }
  }
}

function separateAgents(world) {
  const { agents } = world;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < agents.length; j++) {
      const b = agents[j];
      if (!b.alive) continue;

      const push = circleCirclePush(a.x, a.y, agentRadius(a), b.x, b.y, agentRadius(b));
      if (!push) continue;

      const aResolved = world.static.resolveCircle(a.x + push.x / 2, a.y + push.y / 2, agentRadius(a));
      const bResolved = world.static.resolveCircle(b.x - push.x / 2, b.y - push.y / 2, agentRadius(b));
      a.x = aResolved.x;
      a.y = aResolved.y;
      b.x = bResolved.x;
      b.y = bResolved.y;
    }
  }
}
