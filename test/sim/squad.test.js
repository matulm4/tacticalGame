import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../../src/sim/world/Simulation.js';
import { makeMap, ofType, rect, run, spawn } from '../../test-support/sim.js';

const aimUp = { aimX: 100, aimY: 0 };

/** A sim with grunts at the given [x, y] spots (all facing `angle`), and the player hard to kill. */
function squadSim({ at, angle = Math.PI, obstacles = [], type = 'grunt', team = 'enemy' }) {
  const sim = new Simulation(
    makeMap({ obstacles, spawns: at.map(([x, y], i) => spawn(`e${i}`, x, y, { type, angle, team })) }),
    { seed: 1 },
  );
  sim.world.player.hp = sim.world.player.maxHp = 1000;
  const enemies = sim.world.agents.filter((agent) => agent !== sim.world.player);
  return { sim, world: sim.world, player: sim.world.player, enemies, brains: enemies.map((e) => e.controller.brain) };
}

const squadsOf = (world) => world.squads.squads.map((squad) => squad.members.map((agent) => agent.id).sort((a, b) => a - b));
const startedOf = (events, behavior) => ofType(events, 'squadBehavior').filter((e) => e.phase === 'started' && e.behavior === behavior);
const endedOf = (events, behavior) => ofType(events, 'squadBehavior').filter((e) => e.phase === 'ended' && e.behavior === behavior);

// ---- grouping --------------------------------------------------------------------------

test('agents close to each other form a squad; far-apart ones form separate squads', () => {
  const { sim, world, enemies } = squadSim({ at: [[600, 100], [600, 200], [900, 700]] });
  run(sim, 1, aimUp);
  const [a, b, c] = enemies.map((e) => e.id);
  assert.deepEqual(squadsOf(world), [[a, b], [c]]);
});

test('squads chain: A near B and B near C make one squad even if A and C are far apart', () => {
  const { sim, world, enemies } = squadSim({ at: [[500, 100], [500, 380], [500, 650]] });
  run(sim, 1, aimUp);
  assert.deepEqual(squadsOf(world), [enemies.map((e) => e.id)]);
});

test('a squad has at most four members', () => {
  const { sim, world } = squadSim({ at: [[500, 100], [500, 160], [500, 220], [500, 280], [500, 340], [500, 400]] });
  run(sim, 1, aimUp);
  assert.deepEqual(squadsOf(world).map((members) => members.length).sort(), [2, 4]);
});

test('the player is no one\'s squadmate, and teams do not mix', () => {
  const sim = new Simulation(
    makeMap({ spawns: [spawn('e', 600, 300), spawn('f', 600, 360, { team: 'player' })] }),
    { seed: 1 },
  );
  run(sim, 1, aimUp);
  assert.equal(sim.world.squads.squads.length, 2);
  assert.ok(sim.world.squads.squads.every((squad) => squad.members.length === 1));
});

test('squads keep their identity while the same agents stay together', () => {
  const { sim, world } = squadSim({ at: [[600, 300], [600, 360]] });
  run(sim, 1, aimUp);
  const [squad] = world.squads.squads;
  run(sim, 200, aimUp);
  assert.equal(world.squads.squads[0], squad);
});

test('a dead member leaves its squad', () => {
  const { sim, world, enemies } = squadSim({ at: [[600, 300], [600, 360]] });
  run(sim, 1, aimUp);
  enemies[0].alive = false;
  run(sim, 20, aimUp);
  assert.deepEqual(squadsOf(world), [[enemies[1].id]]);
});

// ---- shared sightings ---------------------------------------------------------------------

test('one member\'s sighting becomes every squadmate\'s', () => {
  // The first grunt faces the player; the second faces away and cannot see anything.
  const { sim, world, player, enemies, brains } = squadSim({ at: [[560, 300], [560, 400]], obstacles: [] });
  player.x = 300;
  player.y = 300;
  enemies[1].aimAngle = 0;
  run(sim, 40, aimUp);

  const [seer, blind] = brains;
  assert.ok(seer.memory.target, 'the first one sees the player');
  assert.equal(blind.memory.target, null, 'the second does not');
  assert.ok(blind.memory.lastKnown, 'but it was told');
  assert.equal(blind.memory.lastKnown.id, player.id);
  assert.ok(Math.hypot(blind.memory.lastKnown.x - player.x, blind.memory.lastKnown.y - player.y) < 30);
  assert.equal(world.squads.squads[0].blackboard.sighting.id, player.id);
});

test('a squadmate that was told about the player treats it as a threat', () => {
  const { sim, player, enemies, brains } = squadSim({
    at: [[560, 300], [560, 400]],
    obstacles: [rect('crate', 620, 250, 40, 250)], // behind them, so it hides them from the player
  });
  player.x = 300;
  player.y = 300;
  enemies[1].aimAngle = 0;
  const events = run(sim, 120, aimUp);
  const goals = ofType(events, 'planChanged').filter((e) => e.agentId === enemies[1].id).map((e) => e.goalId);
  assert.ok(goals.some((goal) => goal === 'Cover' || goal === 'KillEnemy' || goal === 'FollowOrder'), `goals: ${goals}`);
  assert.ok(brains[1].memory.lastKnown);
});

// ---- cover reservations -------------------------------------------------------------------

test('two enemies sharing one crate do not take the same cover position', () => {
  const { sim, player, brains } = squadSim({
    at: [[520, 330], [520, 340]],
    obstacles: [rect('crate', 590, 250, 40, 300)],
  });
  player.x = 300;
  player.y = 400;
  run(sim, 300, aimUp);
  const [a, b] = brains.map((brain) => brain.coverNode);
  assert.ok(a && b, 'both took cover');
  assert.notEqual(a.id, b.id);
});

// ---- squad behaviors ----------------------------------------------------------------------

// Two grunts at the top and bottom of the map see the player in the middle on the far left.
// A crate stands between them and the player, and a lower one closer to the player. They
// settle into the first crate's cover, then work forward to the second.
const standoff = () =>
  squadSim({
    at: [[440, 220], [440, 580]],
    obstacles: [rect('back', 360, 320, 40, 160), rect('front', 220, 340, 40, 80)],
  });

test('in the open, one member suppresses while the other runs for cover', () => {
  const { sim, player, enemies, brains } = squadSim({
    at: [[520, 330], [520, 470]],
    obstacles: [rect('crate', 320, 460, 40, 160)],
  });
  player.x = 150;
  player.y = 400;
  const events = run(sim, 40, { aimX: 150, aimY: 0 });

  assert.equal(startedOf(events, 'getToCover').length, 1);
  const orders = brains.map((brain) => brain.memory.order?.type).sort();
  assert.deepEqual(orders, ['goto-cover', 'suppress']);

  const suppressor = enemies[brains.findIndex((brain) => brain.memory.order?.type === 'suppress')];
  const more = run(sim, 60, { aimX: 150, aimY: 0 });
  assert.ok(ofType(more, 'shotFired').some((e) => e.agentId === suppressor.id), 'the suppressor is firing');
  assert.ok(ofType([...events, ...more], 'bark').some((e) => e.text === 'Get to cover!'));

  const rest = run(sim, 300, { aimX: 150, aimY: 0 });
  assert.equal(endedOf([...more, ...rest], 'getToCover')[0]?.outcome, 'done');
  const mover = brains.find((brain) => brain.coverNode && brain !== brains[enemies.indexOf(suppressor)]);
  assert.ok(mover, 'the other one is in cover');
});

test('from a stand-off the squad advances, one covering the other, and then they swap', () => {
  const { sim, player, enemies } = standoff();
  const events = run(sim, 900, aimUp);

  const advances = startedOf(events, 'advance');
  assert.ok(advances.length >= 2, `advanced ${advances.length} time(s)`);
  for (const e of advances) assert.equal(e.agentIds.length, 2, 'both took part: one fired, one moved');
  assert.ok(ofType(events, 'bark').some((e) => e.text === 'Moving up!'));
  assert.ok(ofType(events, 'bark').some((e) => e.text === 'Suppressing fire!'));

  // They end up closer to the player than the first crate's cover (x about 424).
  for (const enemy of enemies) assert.ok(enemy.x < 400, `x = ${enemy.x}`);
  assert.ok(player.hp < 1000, 'and they were firing');
});

test('an advance does not start before the squad has been fighting for a few seconds', () => {
  const { sim } = standoff();
  const events = run(sim, 120, aimUp); // 2 s
  assert.equal(startedOf(events, 'advance').length, 0);
});

test('the enemy escapes: the squad splits into pairs and searches from two sides', () => {
  // Four grunts face north; the player is far away in a corner. A sighting went cold a few seconds ago.
  const { sim, world, player, enemies, brains } = squadSim({
    at: [[500, 500], [500, 560], [700, 500], [700, 560]],
    angle: -Math.PI / 2,
  });
  player.x = 60;
  player.y = 760;
  brains[0].memory.lastKnown = { id: player.id, x: 500, y: 300, time: -6 };
  const away = { aimX: 60, aimY: 700 };

  const events = run(sim, 12, away);
  assert.equal(startedOf(events, 'search').length, 1);
  const points = brains.map((brain) => brain.memory.order.point);
  assert.ok(brains.every((brain) => brain.memory.order.type === 'search'));

  const spots = [...new Set(points.map((p) => `${Math.round(p.x / 100)},${Math.round(p.y / 100)}`))];
  assert.ok(spots.length >= 2, `two groups, two places: ${spots}`);
  assert.ok(points.some((p) => Math.hypot(p.x - 500, p.y - 300) < 60), 'one pair goes to the last known position');
  assert.ok(points.some((p) => p.y < 200), 'the other pair comes at it from the far side');

  const rest = run(sim, 900, away);
  assert.equal(endedOf(rest, 'search')[0]?.outcome, 'done');
  assert.ok(enemies.every((e) => e.alive));
  assert.ok(brains.every((brain) => brain.memory.order === null), 'orders are withdrawn');
  assert.equal(world.squads.squads[0].behavior, null);
});

test('a search ends as soon as someone sees the enemy', () => {
  const { sim, player, brains } = squadSim({
    at: [[500, 500], [500, 560]],
    angle: -Math.PI / 2,
  });
  player.x = 60;
  player.y = 760;
  brains[0].memory.lastKnown = { id: player.id, x: 500, y: 300, time: -6 };
  const away = { aimX: 60, aimY: 700 };
  assert.equal(startedOf(run(sim, 12, away), 'search').length, 1);

  player.x = 500;
  player.y = 380; // right in front of them
  const events = run(sim, 30, { aimX: 500, aimY: 0 });
  assert.equal(endedOf(events, 'search')[0]?.outcome, 'done');
  assert.ok(brains.every((brain) => brain.memory.order === null));
});

test('a squad does not search for the same sighting twice', () => {
  const { sim, player, brains } = squadSim({ at: [[500, 500], [500, 560]], angle: -Math.PI / 2 });
  player.x = 60;
  player.y = 760;
  brains[0].memory.lastKnown = { id: player.id, x: 500, y: 300, time: -6 };
  const events = run(sim, 900, { aimX: 60, aimY: 700 });
  assert.equal(startedOf(events, 'search').length, 1);
});

test('no squad behavior starts for a lone agent', () => {
  const { sim, player, brains } = squadSim({ at: [[500, 500]], angle: -Math.PI / 2 });
  player.x = 60;
  player.y = 760;
  brains[0].memory.lastKnown = { id: player.id, x: 500, y: 300, time: -6 };
  const events = run(sim, 300, { aimX: 60, aimY: 700 });
  assert.equal(ofType(events, 'squadBehavior').length, 0);
});

test('a sentry takes part by suppressing, but is never ordered to move', () => {
  const sim = new Simulation(
    makeMap({
      obstacles: [rect('crate', 320, 460, 40, 160)],
      spawns: [spawn('s', 520, 330, { type: 'sentry', angle: Math.PI }), spawn('g', 520, 470, { type: 'grunt', angle: Math.PI })],
    }),
    { seed: 1 },
  );
  const { world } = sim;
  world.player.hp = world.player.maxHp = 1000;
  world.player.x = 150;
  world.player.y = 400;
  const sentry = world.agents[1].controller.brain;
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    run(sim, 1, { aimX: 150, aimY: 0 });
    if (sentry.memory.order) seen.add(sentry.memory.order.type);
  }
  assert.ok(!seen.has('goto-cover') && !seen.has('search'), [...seen].join());
});

test('squad behaviors are deterministic', () => {
  const log = () => {
    const { sim } = standoff();
    return JSON.stringify(run(sim, 600, aimUp));
  };
  assert.equal(log(), log());
});
