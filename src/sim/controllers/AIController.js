import { AIBrain } from '../ai/AIBrain.js';

/** Drives an agent with a GOAP brain. Same interface as the player's controller. */
export class AIController {
  /** @param {ConstructorParameters<typeof AIBrain>[0]} options */
  constructor(options) {
    this.brain = new AIBrain(options);
  }

  getIntent(agent, world, dt) {
    return this.brain.think(agent, world, dt);
  }

  /** What the brain is up to (for the debug overlay). */
  debugInfo() {
    return this.brain.debugInfo();
  }
}
