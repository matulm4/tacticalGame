import { COVER_CLAIM_TTL } from '../../defs/tuning.js';

/**
 * Who has claimed which cover position, so two agents do not run for the same
 * one. A claim lapses after a few seconds unless its holder keeps refreshing
 * it (an agent heading for, or sitting in, cover does), so the claims of a dead
 * agent, or one that changed its mind, free themselves.
 */
export class CoverReservations {
  #claims = new Map(); // node id -> { agentId, until }

  /**
   * Claim (or refresh a claim on) a cover position.
   * @returns {boolean} false if someone else holds it
   */
  claim(nodeId, agentId, now) {
    if (this.isTaken(nodeId, agentId, now)) return false;
    this.#claims.set(nodeId, { agentId, until: now + COVER_CLAIM_TTL });
    return true;
  }

  /** Is the position claimed by anyone other than `agentId`? */
  isTaken(nodeId, agentId, now) {
    const claim = this.#claims.get(nodeId);
    return claim !== undefined && claim.until > now && claim.agentId !== agentId;
  }

  /** Drop every claim `agentId` holds. */
  release(agentId) {
    for (const [nodeId, claim] of this.#claims) {
      if (claim.agentId === agentId) this.#claims.delete(nodeId);
    }
  }
}
