// Map file format (version 1) and its validation. Used by the editor, the
// simulation and the tests, so a map is checked the same way everywhere.

import { COVER_HEIGHTS, DEFAULT_COVER_HEIGHT } from '../defs/coverHeights.js';

export const MAP_VERSION = 1;
export const MIN_MAP_SIZE = 200;
export const MAX_MAP_SIZE = 8000;
export const DEFAULT_MAP_WIDTH = 1600;
export const DEFAULT_MAP_HEIGHT = 1000;

const SHAPES = ['rect', 'circle'];

export function createEmptyMap({
  name = 'untitled',
  width = DEFAULT_MAP_WIDTH,
  height = DEFAULT_MAP_HEIGHT,
} = {}) {
  return { version: MAP_VERSION, name, width, height, obstacles: [], playerStart: null, spawns: [] };
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isPositive = (value) => isNumber(value) && value > 0;
const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;

/**
 * Checks a parsed map and returns a clean copy.
 * @returns {{ ok: boolean, errors: string[], map: object | null }}
 */
export function validateMap(input) {
  const errors = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['Map must be an object'], map: null };
  }

  if (input.version !== MAP_VERSION) {
    errors.push(`Unsupported map version ${JSON.stringify(input.version)} (expected ${MAP_VERSION})`);
  }

  const name = input.name === undefined ? 'untitled' : input.name;
  if (typeof name !== 'string') errors.push('name must be a string');

  for (const key of ['width', 'height']) {
    const value = input[key];
    if (!isNumber(value) || value < MIN_MAP_SIZE || value > MAX_MAP_SIZE) {
      errors.push(`${key} must be a number between ${MIN_MAP_SIZE} and ${MAX_MAP_SIZE}`);
    }
  }

  const obstacles = validateObstacles(input.obstacles ?? [], errors);
  const playerStart = validatePlayerStart(input.playerStart ?? null, errors);
  const spawns = validateSpawns(input.spawns ?? [], errors);

  if (errors.length > 0) return { ok: false, errors, map: null };

  return {
    ok: true,
    errors: [],
    map: { version: MAP_VERSION, name, width: input.width, height: input.height, obstacles, playerStart, spawns },
  };
}

function validateObstacles(list, errors) {
  if (!Array.isArray(list)) {
    errors.push('obstacles must be an array');
    return [];
  }

  const seen = new Set();
  const clean = [];
  list.forEach((raw, index) => {
    const label = `obstacles[${index}]`;
    if (typeof raw !== 'object' || raw === null) {
      errors.push(`${label} must be an object`);
      return;
    }

    if (!isNonEmptyString(raw.id)) errors.push(`${label}.id must be a non-empty string`);
    else if (seen.has(raw.id)) errors.push(`${label}.id "${raw.id}" is duplicated`);
    else seen.add(raw.id);

    const height = raw.height === undefined ? DEFAULT_COVER_HEIGHT : raw.height;
    if (!(height in COVER_HEIGHTS)) errors.push(`${label}.height "${height}" is unknown`);

    if (!SHAPES.includes(raw.shape)) {
      errors.push(`${label}.shape must be one of ${SHAPES.join(', ')}`);
      return;
    }

    if (raw.shape === 'rect') {
      if (!isNumber(raw.x) || !isNumber(raw.y)) errors.push(`${label}.x and .y must be numbers`);
      if (!isPositive(raw.w) || !isPositive(raw.h)) errors.push(`${label}.w and .h must be positive numbers`);
      clean.push({ id: raw.id, shape: 'rect', x: raw.x, y: raw.y, w: raw.w, h: raw.h, height });
    } else {
      if (!isNumber(raw.cx) || !isNumber(raw.cy)) errors.push(`${label}.cx and .cy must be numbers`);
      if (!isPositive(raw.r)) errors.push(`${label}.r must be a positive number`);
      clean.push({ id: raw.id, shape: 'circle', cx: raw.cx, cy: raw.cy, r: raw.r, height });
    }
  });
  return clean;
}

function validatePlayerStart(raw, errors) {
  if (raw === null) return null;
  if (typeof raw !== 'object') {
    errors.push('playerStart must be an object or null');
    return null;
  }
  const angle = raw.angle === undefined ? 0 : raw.angle;
  if (!isNumber(raw.x) || !isNumber(raw.y) || !isNumber(angle)) {
    errors.push('playerStart needs numeric x, y (and optional angle)');
    return null;
  }
  return { x: raw.x, y: raw.y, angle };
}

function validateSpawns(list, errors) {
  if (!Array.isArray(list)) {
    errors.push('spawns must be an array');
    return [];
  }

  const seen = new Set();
  const clean = [];
  list.forEach((raw, index) => {
    const label = `spawns[${index}]`;
    if (typeof raw !== 'object' || raw === null) {
      errors.push(`${label} must be an object`);
      return;
    }

    if (!isNonEmptyString(raw.id)) errors.push(`${label}.id must be a non-empty string`);
    else if (seen.has(raw.id)) errors.push(`${label}.id "${raw.id}" is duplicated`);
    else seen.add(raw.id);

    if (!isNonEmptyString(raw.type)) errors.push(`${label}.type must be a non-empty string`);
    const team = raw.team === undefined ? 'enemy' : raw.team;
    if (!isNonEmptyString(team)) errors.push(`${label}.team must be a non-empty string`);
    const angle = raw.angle === undefined ? 0 : raw.angle;
    if (!isNumber(raw.x) || !isNumber(raw.y) || !isNumber(angle)) {
      errors.push(`${label} needs numeric x, y (and optional angle)`);
    }

    clean.push({ id: raw.id, type: raw.type, team, x: raw.x, y: raw.y, angle });
  });
  return clean;
}
