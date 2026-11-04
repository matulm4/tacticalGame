import { AIController } from './AIController.js';

// Which controller drives an archetype (its `ai` field). 'goap' is the F.E.A.R.-style
// brain; the archetype's goalSet and actionSet say what it wants and what it can do.
const FACTORIES = {
  goap: (options) => new AIController(options),
};

/**
 * A new controller of the given kind, or null for agents that have none.
 * @param {string | undefined} kind
 * @param {{ def: object, home: { x: number, y: number, angle: number } }} options
 */
export function createController(kind, options) {
  if (!kind) return null;
  const create = FACTORIES[kind];
  if (!create) throw new Error(`Unknown AI controller "${kind}"`);
  return create(options);
}
