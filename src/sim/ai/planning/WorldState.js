import { UNSET, VAR, VARIABLES } from './worldStateSchema.js';

function slot(name) {
  const index = VAR[name];
  if (index === undefined) throw new Error(`Unknown world state variable "${name}"`);
  return index;
}

/**
 * A fixed-size array of variable values. Used both for the full state of the
 * world as an agent sees it, and for partial states (a goal, an action's
 * preconditions or effects) where variables that do not matter are UNSET.
 */
export class WorldState {
  constructor(values = null) {
    this.values = values ?? new Array(VARIABLES.length).fill(UNSET);
  }

  /** @param {Record<string, boolean | number>} variables  e.g. { TargetVisible: true, AtNode: 4 } */
  static from(variables) {
    const state = new WorldState();
    for (const [name, value] of Object.entries(variables)) state.set(name, value);
    return state;
  }

  get(name) {
    return this.values[slot(name)];
  }

  set(name, value) {
    this.values[slot(name)] = typeof value === 'boolean' ? Number(value) : value;
    return this;
  }

  clone() {
    return new WorldState(this.values.slice());
  }

  /** A string that is equal for equal states (for the planner's visited set). */
  key() {
    return this.values.join(',');
  }

  /** Only the variables that are set, by name (for debugging and tests). */
  toObject() {
    const result = {};
    VARIABLES.forEach((name, index) => {
      if (this.values[index] !== UNSET) result[name] = this.values[index];
    });
    return result;
  }
}
