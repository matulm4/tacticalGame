import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MapStorage, mapFileName, parseMapText, serializeMap } from '../../src/client/storage/MapStorage.js';
import { makeMap, rect, spawn } from '../../test-support/sim.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

const map = () => makeMap({ obstacles: [rect('a', 10, 10, 50, 50)], spawns: [spawn('s1', 500, 500)] });

test('serialize then parse gives the same map back', () => {
  const result = parseMapText(serializeMap(map()));
  assert.ok(result.ok);
  assert.deepEqual(result.map, map());
});

test('parseMapText reports bad JSON and invalid maps', () => {
  assert.equal(parseMapText('{ nope').ok, false);
  assert.match(parseMapText('{ nope').errors[0], /JSON/);
  const invalid = parseMapText(JSON.stringify({ version: 99 }));
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.length > 0);
});

test('file names come from the map name, safely', () => {
  assert.equal(mapFileName({ name: 'My Arena!' }), 'my-arena.json');
  assert.equal(mapFileName({ name: '  ../../etc/passwd ' }), 'etc-passwd.json');
  assert.equal(mapFileName({ name: '???' }), 'map.json');
  assert.equal(mapFileName({}), 'map.json');
});

test('autosave round-trips through storage', () => {
  const storage = new MapStorage({ storage: fakeStorage() });
  assert.equal(storage.loadAutosave(), null);
  assert.equal(storage.saveAutosave(map()), true);
  assert.deepEqual(storage.loadAutosave(), map());

  storage.clearAutosave();
  assert.equal(storage.loadAutosave(), null);
});

test('a corrupt or invalid autosave is ignored', () => {
  const key = 'tactical-shooter.autosave.v1';
  assert.equal(new MapStorage({ storage: fakeStorage({ [key]: 'garbage' }) }).loadAutosave(), null);
  assert.equal(new MapStorage({ storage: fakeStorage({ [key]: '{"version":99}' }) }).loadAutosave(), null);
});

test('missing or failing storage never throws', () => {
  const none = new MapStorage({ storage: null });
  assert.equal(none.saveAutosave(map()), false);
  assert.equal(none.loadAutosave(), null);
  none.clearAutosave();

  const broken = new MapStorage({
    storage: {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('blocked'); },
    },
  });
  assert.equal(broken.saveAutosave(map()), false);
  assert.equal(broken.loadAutosave(), null);
  broken.clearAutosave();
});

test('readFile validates what the user opens', async () => {
  const storage = new MapStorage({ storage: null });
  const good = await storage.readFile({ text: async () => serializeMap(map()) });
  assert.ok(good.ok);
  const bad = await storage.readFile({ text: async () => 'not json' });
  assert.equal(bad.ok, false);
});
