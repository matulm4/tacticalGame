// Who may hurt whom. Same-team agents never do. A new faction (for AI vs AI)
// is a new pair in HOSTILE_PAIRS.

export const TEAMS = Object.freeze({ PLAYER: 'player', ENEMY: 'enemy' });

const HOSTILE_PAIRS = new Set([pairKey(TEAMS.PLAYER, TEAMS.ENEMY)]);

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function isHostile(teamA, teamB) {
  if (teamA === teamB) return false;
  return HOSTILE_PAIRS.has(pairKey(teamA, teamB));
}
