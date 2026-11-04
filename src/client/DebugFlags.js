/** Which debug overlays are switched on. Shared by the debug panel, the hotkeys and the play mode. */
export class DebugFlags {
  static NAMES = Object.freeze(['vision', 'noise', 'plan', 'cover', 'squads']);

  vision = false;
  noise = false;
  plan = false;
  cover = false;
  squads = false;
  #listeners = new Set();

  set(name, value) {
    if (!DebugFlags.NAMES.includes(name)) throw new Error(`Unknown debug flag "${name}"`);
    this[name] = Boolean(value);
    for (const listener of this.#listeners) listener(this);
  }

  toggle(name) {
    this.set(name, !this[name]);
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
