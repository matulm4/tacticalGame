import { Attack } from '../actions/Attack.js';
import { AttackFromCover } from '../actions/AttackFromCover.js';
import { BlindFireFromCover } from '../actions/BlindFireFromCover.js';
import { DodgeCovered } from '../actions/DodgeCovered.js';
import { DodgeShuffle } from '../actions/DodgeShuffle.js';
import { GotoNode } from '../actions/GotoNode.js';
import { InvestigatePoint } from '../actions/InvestigatePoint.js';
import { LookAround } from '../actions/LookAround.js';
import { LookAtNoise } from '../actions/LookAtNoise.js';
import { MoveToCover } from '../actions/MoveToCover.js';
import { Reload } from '../actions/Reload.js';
import { SearchPoint } from '../actions/SearchPoint.js';
import { SuppressFire } from '../actions/SuppressFire.js';

// What an archetype can do (its `actionSet`). Characters with the SAME goals but
// DIFFERENT action sets behave differently: a goal an agent has no action for is
// simply one it cannot plan, and it falls back to the next goal. Here a stationary
// guard wants to investigate noises, take cover and dodge like a soldier, but
// cannot walk, so it cannot do those: it satisfies "investigate" by turning to look.
// Each agent gets its own instances (actions keep state while running).

export const ACTION_SETS = Object.freeze({
  soldier: () => [
    new Attack(),
    new AttackFromCover(),
    new BlindFireFromCover(),
    new Reload(),
    new InvestigatePoint(),
    new LookAtNoise(),
    new GotoNode(),
    new LookAround(),
    new DodgeShuffle(),
    new DodgeCovered(),
    new MoveToCover(),
    new SuppressFire(),
    new SearchPoint(),
  ],

  stationary: () => [new Attack(), new Reload(), new LookAtNoise(), new LookAround(), new SuppressFire()],
});
