import { agentRadius } from '../entities/Agent.js';

/**
 * Lowers an agent's hp and announces the result. Dead agents stay in the world
 * (the renderer fades them out) but take no further damage.
 * A health system (regeneration, medkits) will sit next to this later.
 */
export function applyDamage(world, victim, amount, sourceId) {
  if (!victim.alive || amount <= 0) return;

  victim.hp = Math.max(0, victim.hp - amount);
  // Where and who, so the renderer can show the hit without looking the agent up.
  const where = { x: victim.x, y: victim.y, team: victim.team, radius: agentRadius(victim) };
  world.emit('agentDamaged', { agentId: victim.id, amount, hp: victim.hp, sourceId, ...where });

  if (victim.hp === 0) {
    victim.alive = false;
    world.emit('agentDied', { agentId: victim.id, killerId: sourceId, ...where });
  }
}
