import { emptyIntent, sanitizeIntent } from '../entities/Intent.js';

/** Asks every alive agent's controller what it wants to do this tick. */
export function controllerSystem(world, dt) {
  for (const agent of world.agents) {
    if (!agent.alive || !agent.controller) {
      agent.intent = emptyIntent(agent.aimAngle);
      continue;
    }
    agent.intent = sanitizeIntent(agent.controller.getIntent(agent, world, dt), agent.aimAngle);
    agent.aimAngle = agent.intent.aimAngle;
  }
}
