/**
 * Applies crouch intent. Crouching is always allowed.
 *
 * Standing up needs room for the larger standing body. A crouched agent can be
 * flush against a wall, where the standing circle would overlap it, so the
 * agent is nudged clear of the wall as it stands. It only stays crouched when
 * there is genuinely no room (e.g. a gap narrower than the standing body).
 */
export function stanceSystem(world) {
  for (const agent of world.agents) {
    if (!agent.alive || agent.intent.crouch === agent.crouched) continue;

    if (agent.intent.crouch) {
      agent.crouched = true;
    } else {
      const standingRadius = agent.def.radius;
      const spot = world.static.resolveCircle(agent.x, agent.y, standingRadius);
      if (!world.static.circleFits(spot.x, spot.y, standingRadius)) continue;
      agent.x = spot.x;
      agent.y = spot.y;
      agent.crouched = false;
    }
    world.emit('stanceChanged', { agentId: agent.id, crouched: agent.crouched });
  }
}
