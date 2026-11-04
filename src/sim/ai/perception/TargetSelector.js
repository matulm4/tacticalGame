/**
 * Attention selection: with several hostiles in view, pick the one the agent
 * reasons about (the planner only ever handles one target). Keeps the current
 * target while it stays visible so the agent does not flip-flop; otherwise the nearest.
 */
export function selectTarget(observer, visible, currentTargetId = null) {
  if (visible.length === 0) return null;

  const current = visible.find((agent) => agent.id === currentTargetId);
  if (current) return current;

  let nearest = visible[0];
  let nearestDistance = Math.hypot(nearest.x - observer.x, nearest.y - observer.y);
  for (const agent of visible) {
    const distance = Math.hypot(agent.x - observer.x, agent.y - observer.y);
    if (distance < nearestDistance) {
      nearest = agent;
      nearestDistance = distance;
    }
  }
  return nearest;
}
