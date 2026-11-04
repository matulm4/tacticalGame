// Global simulation constants. Grows as systems are added.

/** Fixed simulation rate in ticks per second. */
export const TICK_RATE = 60;

/** Distance an agent walks between two footstep sounds (world units). */
export const FOOTSTEP_DISTANCE = 56;

/** How often AI agents look around (sight checks per second). Hearing is read every tick. */
export const SENSOR_RATE = 15;

/** Navigation grid cell size (world units). */
export const NAV_CELL_SIZE = 20;

/** How far a path keeps its center from walls: a standing agent's radius plus a margin. */
export const NAV_CLEARANCE = 20;

/** Seconds an agent keeps treating a hostile it lost sight of as a threat (it may be hiding). */
export const THREAT_MEMORY = 5;

/** Seconds an agent waits before trying to plan again after finding nothing to do. */
export const REPLAN_RETRY = 0.5;

// ---- squads ----------------------------------------------------------------------------

/** How often squads think (sharing sightings, checking behaviors), per second. */
export const SQUAD_RATE = 10;

/** Seconds between re-clustering idle agents into squads. */
export const SQUAD_RECLUSTER = 1;

/** Two same-team agents closer than this belong to the same squad (chains of such links count). */
export const SQUAD_LINK_DISTANCE = 320;

/** Most agents in one squad (bigger clusters are split). */
export const SQUAD_MAX_SIZE = 4;

/** Seconds a cover position stays claimed after its holder last refreshed the claim. */
export const COVER_CLAIM_TTL = 4;
