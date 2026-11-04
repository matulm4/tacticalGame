import { PriorityQueue } from '../../../core/priorityQueue.js';
import { PARAM, UNSET, VARIABLES } from './worldStateSchema.js';

/**
 * Goal-oriented action planning: A* over world states, as in F.E.A.R.
 *
 * The search runs backwards from the goal. A search node is the set of things
 * still NEEDED (a partial world state). Starting from the goal, an action is
 * applied "in reverse": its effects satisfy some of the needs, and its
 * preconditions become new needs. When every remaining need is already true in
 * the agent's current world state, the actions on the way form the plan, and
 * (because the search worked backwards) the last one found runs first.
 *
 *   goal { TargetDead }
 *   <- Attack     (effect TargetDead; needs TargetVisible, WeaponLoaded)
 *   <- Reload     (effect WeaponLoaded)       current: WeaponLoaded is false
 *   plan: Reload, then Attack
 *
 * The cost of a plan is the sum of its actions' costs; A* finds the cheapest.
 * Actions get a last say through checkProceduralPreconditions() (e.g. "is
 * there a path?"), which only runs for actions that otherwise fit.
 */
export class Planner {
  /**
   * @param {object} [options]
   * @param {number} [options.maxExpansions]  search budget: nodes expanded before giving up
   * @param {number} [options.maxDepth]       longest plan considered
   */
  constructor({ maxExpansions = 300, maxDepth = 8 } = {}) {
    this.maxExpansions = maxExpansions;
    this.maxDepth = maxDepth;
  }

  /**
   * @param {import('./WorldState.js').WorldState} current  how the world is now
   * @param {import('./WorldState.js').WorldState} goal     the partial state to reach
   * @param {import('./Action.js').Action[]} actions        what the agent can do
   * @param {object} ctx                                    passed to procedural preconditions
   * @returns {{ steps: { action: object, bindings: object }[], cost: number, expansions: number } | null}
   *   steps in the order to run them (empty if the goal already holds); null if no plan exists
   */
  plan(current, goal, actions, ctx) {
    const now = current.values;
    const start = { needs: goal.values.slice(), cost: 0, depth: 0, parent: null, action: null, bindings: null };
    if (!hasUnmetNeeds(start.needs, now)) return { steps: [], cost: 0, expansions: 0 };

    // Any plan still to be found costs at least one more action.
    const cheapest = Math.min(...actions.map((action) => action.cost));
    const estimate = (needs) => (hasUnmetNeeds(needs, now) ? cheapest : 0);

    const open = new PriorityQueue();
    open.push(start, estimate(start.needs));
    const bestCost = new Map([[start.needs.join(','), 0]]);

    let expansions = 0;
    while (open.size > 0 && expansions < this.maxExpansions) {
      const node = open.pop();
      if (!hasUnmetNeeds(node.needs, now)) return { steps: stepsOf(node), cost: node.cost, expansions };
      if (node.depth >= this.maxDepth) continue;
      expansions++;

      for (const action of actions) {
        const child = this.#regress(node, action, now, ctx);
        if (!child) continue;

        const key = child.needs.join(',');
        if (bestCost.has(key) && bestCost.get(key) <= child.cost) continue;
        bestCost.set(key, child.cost);
        open.push(child, child.cost + estimate(child.needs));
      }
    }
    return null;
  }

  /** Apply `action` in reverse to a search node, or null if it does not fit. */
  #regress(node, action, now, ctx) {
    const effects = action.effects.values;
    const preconditions = action.preconditions.values;
    const needs = node.needs.slice();
    const bindings = {};
    let useful = false;

    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      const need = node.needs[i];
      if (effect === UNSET || need === UNSET) continue; // nobody cares about this variable

      if (effect === PARAM) {
        bindings[i] = need; // it can be whatever the need asks for
      } else if (effect !== need) {
        return null; // the action would leave this variable at the wrong value
      }
      if (need !== now[i]) useful = true; // it helps with something not yet true
      needs[i] = UNSET; // satisfied by this action
    }
    if (!useful) return null;

    for (let i = 0; i < preconditions.length; i++) {
      const precondition = preconditions[i];
      if (precondition === UNSET) continue;
      if (needs[i] !== UNSET && needs[i] !== precondition) return null; // contradicts another need
      needs[i] = precondition;
    }

    const named = nameBindings(bindings);
    if (!action.checkProceduralPreconditions(ctx, named)) return null;

    return { needs, cost: node.cost + action.cost, depth: node.depth + 1, parent: node, action, bindings: named };
  }
}

function hasUnmetNeeds(needs, now) {
  for (let i = 0; i < needs.length; i++) {
    if (needs[i] !== UNSET && needs[i] !== now[i]) return true;
  }
  return false;
}

/** The plan in execution order. Walking up from the last node found gives it directly. */
function stepsOf(node) {
  const steps = [];
  for (let n = node; n.parent !== null; n = n.parent) steps.push({ action: n.action, bindings: n.bindings });
  return steps;
}

/** { 6: 4 } (slot -> value) becomes { AtNode: 4 } (name -> value). */
function nameBindings(bySlot) {
  const named = {};
  for (const [index, value] of Object.entries(bySlot)) named[VARIABLES[index]] = value;
  return named;
}
