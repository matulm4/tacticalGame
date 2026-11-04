import { COVER_HEIGHTS } from '../defs/coverHeights.js';
import { isHostile } from '../defs/teams.js';

/**
 * Delivers this tick's sounds to the agents that can hear them.
 *
 * A listener hears a sound when it is within the sound's radius (scaled by the
 * listener's hearing sensitivity). Every obstacle between them muffles it: the
 * radius is multiplied by that obstacle's `soundDampening`. Agents ignore sounds
 * from their own side, and dead agents or agents without hearing hear nothing.
 *
 * Results land in `agent.heardSounds` (replaced every tick): { kind, x, y,
 * distance, loudness (0..1), sourceId }. The AI reads them on its next turn.
 */
export function soundSystem(world) {
  for (const agent of world.agents) agent.heardSounds = [];

  for (const sound of world.sounds) {
    for (const listener of world.agents) {
      if (!listener.alive || !listener.def.hearing || !isHostile(sound.team, listener.team)) continue;

      const maxReach = sound.radius * listener.def.hearing.sensitivity;
      const distance = Math.hypot(listener.x - sound.x, listener.y - sound.y);
      if (distance > maxReach) continue; // too far even through open air

      let reach = maxReach;
      for (const obstacle of world.static.crossedObstacles(sound.x, sound.y, listener.x, listener.y)) {
        reach *= COVER_HEIGHTS[obstacle.height].soundDampening;
      }
      if (distance > reach) continue;

      listener.heardSounds.push({
        kind: sound.kind,
        x: sound.x,
        y: sound.y,
        distance,
        loudness: 1 - distance / reach,
        sourceId: sound.sourceId,
      });
    }
  }

  world.sounds = [];
}
