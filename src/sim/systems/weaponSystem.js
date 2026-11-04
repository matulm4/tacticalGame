import { DEG } from '../../core/math.js';
import { activeWeaponOf } from '../entities/Agent.js';
import { createBullet } from '../entities/Bullet.js';
import { obstacleBlocks } from '../map/coverRules.js';

/**
 * Trigger, fire rate, magazine and reload for every alive agent. Ammo is
 * unlimited; only the magazine is limited, so reloading is the cost of firing.
 */
export function weaponSystem(world, dt) {
  for (const agent of world.agents) {
    if (!agent.alive) continue;
    const weapon = activeWeaponOf(agent);
    if (!weapon) continue;
    const { def } = weapon;
    const { intent } = agent;

    weapon.cooldown = Math.max(weapon.cooldown - dt, -dt);

    if (weapon.reloadLeft > 0) {
      weapon.reloadLeft -= dt;
      if (weapon.reloadLeft <= 0) {
        weapon.reloadLeft = 0;
        weapon.ammo = def.magSize;
        world.emit('reloadFinished', { agentId: agent.id, weaponId: def.id });
      }
    }

    if (intent.reload && weapon.reloadLeft === 0 && weapon.ammo < def.magSize) {
      weapon.reloadLeft = def.reloadTime;
      world.emit('reloadStarted', { agentId: agent.id, weaponId: def.id });
    }

    const triggerPressed = intent.fire && !weapon.triggerHeld;
    weapon.triggerHeld = intent.fire;

    const ready = weapon.reloadLeft === 0 && weapon.ammo > 0 && weapon.cooldown <= 0;
    if (intent.fire && ready && (def.auto || triggerPressed)) {
      fire(world, agent, weapon);
    }
  }
}

function fire(world, agent, weapon) {
  const { def } = weapon;
  const { intent } = agent;
  const blind = intent.blind !== null;

  weapon.ammo -= 1;
  weapon.cooldown += 1 / def.fireRate;

  // Agents that cannot walk (speed 0, e.g. a turret) never get the moving penalty.
  const walkingFraction = agent.def.speed > 0 ? Math.min(agent.speed / agent.def.speed, 1) : 0;
  let spreadDeg =
    def.spreadDeg * (agent.crouched ? def.crouchSpreadMult : 1) + def.moveSpreadDeg * walkingFraction;
  if (blind) spreadDeg *= def.blindSpreadMult;

  const aim = agent.aimAngle;
  let originX = agent.x + Math.cos(aim) * def.muzzleLength;
  let originY = agent.y + Math.sin(aim) * def.muzzleLength;
  if (blind) {
    originX += intent.blind.x;
    originY += intent.blind.y;
  }

  world.emit('shotFired', { agentId: agent.id, weaponId: def.id, x: originX, y: originY, angle: aim });
  world.emitSound({
    kind: 'gunshot',
    x: agent.x,
    y: agent.y,
    radius: def.noiseRadius,
    sourceId: agent.id,
    team: agent.team,
  });

  // A wall between the hand and the muzzle swallows the shot (no shooting through a
  // wall you are touching). The same cover rule as bullets in flight applies. The hand
  // is the body, except in blind fire, where the arm reaches out by the blind offset
  // (around the corner of a high wall; zero over low cover).
  const handX = blind ? agent.x + intent.blind.x : agent.x;
  const handY = blind ? agent.y + intent.blind.y : agent.y;
  const blocker = world.static.raycast(handX, handY, originX, originY, (obstacle) =>
    obstacleBlocks(obstacle.height, { sourceCrouched: agent.crouched, blind }),
  );
  if (blocker) {
    world.emit('bulletHit', { kind: 'wall', x: blocker.x, y: blocker.y, obstacleId: blocker.obstacle.id, ownerId: agent.id });
    return;
  }

  for (let pellet = 0; pellet < def.pellets; pellet++) {
    const angle = aim + world.rng.range(-spreadDeg, spreadDeg) * DEG;
    world.bullets.push(
      createBullet({
        id: world.nextId(),
        x: originX,
        y: originY,
        vx: Math.cos(angle) * def.bulletSpeed,
        vy: Math.sin(angle) * def.bulletSpeed,
        ownerId: agent.id,
        team: agent.team,
        damage: def.damage,
        ttl: def.range / def.bulletSpeed,
        shooterCrouched: agent.crouched,
        blind,
      }),
    );
  }
}
