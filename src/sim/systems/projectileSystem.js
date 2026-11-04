import { segmentCircleHit, segmentExitRect } from '../../core/geometry.js';
import { isHostile } from '../defs/teams.js';
import { agentRadius } from '../entities/Agent.js';
import { obstacleBlocks } from '../map/coverRules.js';
import { applyDamage } from './damageSystem.js';

/**
 * Advances bullets with a swept test (no tunneling) against obstacles, hostile
 * agents and the map edge. Cover follows map/coverRules.js: high obstacles stop
 * everything; a bullet flies over low ones unless its shooter was crouched
 * (non-blind), and a crouched victim is shielded by any low obstacle crossed
 * on the way from the muzzle.
 */
export function projectileSystem(world, dt) {
  const survivors = [];

  for (const bullet of world.bullets) {
    const startX = bullet.x;
    const startY = bullet.y;
    const endX = startX + bullet.vx * dt;
    const endY = startY + bullet.vy * dt;
    bullet.prevX = startX;
    bullet.prevY = startY;
    bullet.ttl -= dt;

    const wallHit = world.static.raycast(startX, startY, endX, endY, (obstacle) =>
      obstacleBlocks(obstacle.height, { sourceCrouched: bullet.shooterCrouched, blind: bullet.blind }),
    );
    const agentHit = nearestAgentHit(world, bullet, startX, startY, endX, endY);

    if (agentHit && (!wallHit || agentHit.t < wallHit.t)) {
      resolveAgentHit(world, bullet, agentHit, startX, startY, endX, endY);
      continue;
    }
    if (wallHit) {
      world.emit('bulletHit', { kind: 'wall', x: wallHit.x, y: wallHit.y, obstacleId: wallHit.obstacle.id, ownerId: bullet.ownerId });
      continue;
    }

    const exitT = segmentExitRect(startX, startY, endX, endY, 0, 0, world.static.width, world.static.height);
    if (exitT !== null) {
      world.emit('bulletHit', {
        kind: 'bounds',
        x: startX + (endX - startX) * exitT,
        y: startY + (endY - startY) * exitT,
        ownerId: bullet.ownerId,
      });
      continue;
    }

    if (bullet.ttl <= 0) continue;

    bullet.x = endX;
    bullet.y = endY;
    survivors.push(bullet);
  }

  world.bullets = survivors;
}

function nearestAgentHit(world, bullet, startX, startY, endX, endY) {
  let best = null;
  for (const agent of world.agents) {
    if (!agent.alive || agent.id === bullet.ownerId || !isHostile(bullet.team, agent.team)) continue;
    const t = segmentCircleHit(startX, startY, endX, endY, agent.x, agent.y, agentRadius(agent));
    if (t !== null && (best === null || t < best.t)) best = { t, agent };
  }
  return best;
}

function resolveAgentHit(world, bullet, { t, agent }, startX, startY, endX, endY) {
  const hitX = startX + (endX - startX) * t;
  const hitY = startY + (endY - startY) * t;

  if (agent.crouched) {
    const shield = world.static.raycast(bullet.originX, bullet.originY, hitX, hitY, (obstacle) =>
      obstacleBlocks(obstacle.height, {
        sourceCrouched: bullet.shooterCrouched,
        targetCrouched: true,
        blind: bullet.blind,
      }),
    );
    if (shield) {
      world.emit('bulletHit', { kind: 'wall', x: shield.x, y: shield.y, obstacleId: shield.obstacle.id, ownerId: bullet.ownerId });
      return;
    }
  }

  world.emit('bulletHit', { kind: 'agent', x: hitX, y: hitY, agentId: agent.id, ownerId: bullet.ownerId });
  applyDamage(world, agent, bullet.damage, bullet.ownerId);
}
