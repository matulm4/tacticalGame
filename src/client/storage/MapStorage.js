import { validateMap } from '../../sim/map/mapSchema.js';

const AUTOSAVE_KEY = 'tactical-shooter.autosave.v1';

/** Parse and validate map JSON text. @returns {{ ok: boolean, errors: string[], map: object | null }} */
export function parseMapText(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [`Not valid JSON: ${error.message}`], map: null };
  }
  return validateMap(json);
}

export function serializeMap(map) {
  return `${JSON.stringify(map, null, 2)}\n`;
}

/** 'My Arena!' -> 'my-arena.json' */
export function mapFileName(map) {
  const base = String(map.name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-]+$/g, ''); // no leading dots (hidden files) or dashes
  return `${base || 'map'}.json`;
}

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // blocked (private window, cleared site data, ...)
  }
}

/**
 * Where maps come from and go to: the browser's localStorage (autosave), files
 * the user opens or saves, and the sample maps served from /maps. Storage can
 * be missing or throw, so every access is guarded and the editor keeps working.
 */
export class MapStorage {
  #storage;

  /** @param {{ storage?: { getItem, setItem, removeItem } | null }} [options] */
  constructor({ storage = browserStorage() } = {}) {
    this.#storage = storage;
  }

  saveAutosave(map) {
    try {
      this.#storage?.setItem(AUTOSAVE_KEY, JSON.stringify(map));
      return this.#storage !== null;
    } catch {
      return false;
    }
  }

  /** The autosaved map, or null when there is none or it is unusable. */
  loadAutosave() {
    try {
      const text = this.#storage?.getItem(AUTOSAVE_KEY);
      if (!text) return null;
      const result = parseMapText(text);
      return result.ok ? result.map : null;
    } catch {
      return null;
    }
  }

  clearAutosave() {
    try {
      this.#storage?.removeItem(AUTOSAVE_KEY);
    } catch {
      // nothing to clear
    }
  }

  /** Reads and validates a File the user picked. */
  async readFile(file) {
    return parseMapText(await file.text());
  }

  /** Offers the map to the user as a .json download. */
  download(map) {
    const url = URL.createObjectURL(new Blob([serializeMap(map)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = mapFileName(map);
    link.click();
    URL.revokeObjectURL(url);
  }

  /** @returns {Promise<{ name: string, file: string }[]>} the sample maps listed in maps/index.json */
  async fetchSamples() {
    const response = await fetch('maps/index.json');
    if (!response.ok) throw new Error(`maps/index.json: HTTP ${response.status}`);
    return (await response.json()).maps;
  }

  /** Loads a sample map from /maps by file name; throws if it is missing or invalid. */
  async fetchSample(file) {
    const response = await fetch(`maps/${file}`);
    if (!response.ok) throw new Error(`maps/${file}: HTTP ${response.status}`);
    const result = parseMapText(await response.text());
    if (!result.ok) throw new Error(`maps/${file} is invalid: ${result.errors.join('; ')}`);
    return result.map;
  }
}
