import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidCover } from '../../src/sim/ai/cover/CoverQuery.js';
import { canSee } from '../../src/sim/ai/perception/SightSensor.js';
import { Simulation } from '../../src/sim/world/Simulation.js';
import { makeAccurate, makeMap, ofType, rect, run, spawn } from '../../test-support/sim.js';

// An enemy stands at (500, 400) facing the player at (200, 400). A crate stands just behind it
// (x 520..560, y 300..500), so there is cover on its far side. By default the player stands
// still, aiming straight up: not at anyone, and not firing. The player is hard to kill
// (so a fight can be watched) unless `mortal` is set.
function scenario({ height = 'high', type = 'grunt', crate = true, enemyAt = [500, 400], accurate = true, mortal = false } = {}) {
  const sim = new Simulation(
    makeMap({
      obstacles: crate ? [rect('crate', 520, 300, 40, 200, height)] : [],
      spawns: [spawn('e', enemyAt[0], enemyAt[1], { type, angle: Math.PI })],
    }),
    { seed: 1 },
  );
  const [player, enemy] = sim.world.agents;
  player.x = 200;
  player.y = 400;
  if (!mortal) player.hp = player.maxHp = 1000;
  if (accurate) makeAccurate(enemy);
  return { sim, world: sim.world, player, enemy, brain: enemy.controller.brain };
}

const aimUp = { aimX: 200, aimY: 0 };
const plansOf = (events, goalId) => ofType(events, 'planChanged').filter((e) => e.goalId === goalId);
const shotsBy = (events, agent) => ofType(events, 'shotFired').filter((e) => e.agentId === agent.id);

/** Run tick by tick, calling `each(tick)` after every step. Returns all events. */
function runWatching(sim, ticks, input, each) {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    events.push(...run(sim, 1, input));
    each?.(i);
  }
  return events;
}

// ---- seeking cover -------------------------------------------------------------------

test('an enemy that sees the player runs for cover and hides behind it', () => {
  const { sim, world, player, enemy, brain } = scenario();
  const events = run(sim, 240, aimUp);

  const plan = plansOf(events, 'Cover').find((e) => e.agentId === enemy.id);
  assert.deepEqual(plan.actions, ['GotoNode'], 'a plan to go to the cover');

  assert.ok(brain.coverNode, 'it settled into cover');
  assert.ok(enemy.x > 560, `it is on the far side of the crate (x = ${enemy.x})`);
  assert.ok(isValidCover(world, brain.coverNode, player), 'and the cover really hides it');
  assert.equal(canSee(world, enemy, player), false);
});

test('it says it is taking cover', () => {
  const { sim, enemy } = scenario();
  const words = ofType(run(sim, 120, aimUp), 'bark').filter((e) => e.agentId === enemy.id).map((e) => e.text);
  assert.ok(words.includes('Taking cover!'));
});

test('without any cover nearby it simply fights in the open', () => {
  const { sim, enemy } = scenario({ crate: false });
  const events = run(sim, 60, aimUp);
  assert.equal(plansOf(events, 'Cover').length, 0);
  assert.ok(plansOf(events, 'KillEnemy').some((e) => e.agentId === enemy.id && e.actions.join() === 'Attack'));
});

test('an enemy that cannot walk never goes for cover', () => {
  const { sim, enemy } = scenario({ type: 'sentry' });
  const events = run(sim, 300, aimUp);
  assert.equal(plansOf(events, 'Cover').length, 0);
  assert.deepEqual([enemy.x, enemy.y], [500, 400]);
});

// ---- fighting from cover -------------------------------------------------------------

test('from cover it peeks out, fires, and ducks back, over and over', () => {
  const { sim, world, player, enemy } = scenario();

  const states = [];
  const events = runWatching(sim, 720, aimUp, () => {
    if (enemy.x > 560) states.push({ crouched: enemy.crouched, visible: canSee(world, enemy, player) });
  });

  assert.ok(plansOf(events, 'KillEnemy').some((e) => e.actions.join() === 'AttackFromCover'));
  assert.ok(shotsBy(events, enemy).length > 0, 'it fired');
  assert.ok(states.some((s) => s.crouched), 'it crouched behind the crate');
  assert.ok(states.some((s) => !s.crouched && s.visible), 'and stood up to be seen while firing');

  const hiddenShare = states.filter((s) => !s.visible).length / states.length;
  assert.ok(hiddenShare > 0.5, `it spent most of its time hidden (${Math.round(hiddenShare * 100)}%)`);
});

test('peeking from cover is enough to win a fight against a player standing still', () => {
  const { sim, player } = scenario({ mortal: true });
  const events = run(sim, 1500, aimUp);
  assert.equal(player.alive, false);
  assert.deepEqual(ofType(events, 'matchEnded').map((e) => e.outcome), ['lose']);
});

test('it uses the plain attack in the open, and the cover attack only from cover', () => {
  const { sim, brain } = scenario();
  const used = new Set();
  runWatching(sim, 600, aimUp, () => {
    if (brain.plan?.goal.id === 'KillEnemy') used.add(`${brain.coverNode ? 'cover' : 'open'}:${brain.plan.steps.at(-1).action.id}`);
  });
  assert.ok(!used.has('cover:Attack'), `in cover it should not stand and shoot: ${[...used]}`);
});

// ---- blind fire ----------------------------------------------------------------------

/** Settle an enemy into cover, then keep it "under fire" (and its threat fresh) for a while. */
function underFire(scenarioOptions, ticks = 150) {
  const { sim, world, player, enemy, brain } = scenario(scenarioOptions);
  run(sim, 180, aimUp); // gets to cover

  const seenBullets = [];
  const crouched = [];
  const events = runWatching(sim, ticks, aimUp, () => {
    brain.memory.underFireAt = world.time;
    if (brain.memory.lastKnown) brain.memory.lastKnown.time = world.time; // it has not forgotten the player
    seenBullets.push(...world.bullets.filter((b) => b.ownerId === enemy.id));
    crouched.push(enemy.crouched);
  });
  return { sim, world, player, enemy, brain, events, seenBullets, crouched };
}

test('under fire behind low cover it stays crouched and fires blind over the top', () => {
  const { player, events, seenBullets, crouched, enemy } = underFire({ height: 'low' });

  assert.ok(plansOf(events, 'KillEnemy').some((e) => e.actions.join() === 'BlindFireFromCover'));
  assert.ok(seenBullets.length > 0, 'it fired');
  assert.ok(seenBullets.every((b) => b.blind && b.shooterCrouched), 'blind shots from a crouched shooter');
  assert.ok(crouched.filter(Boolean).length > crouched.length / 2, 'it stayed down');
  assert.ok(player.hp < 1000, 'shots going over the low wall reach a standing player');
  assert.ok(shotsBy(events, enemy).length > 0);
});

test('under fire behind high cover it reaches round the corner to fire blind', () => {
  const { events, seenBullets } = underFire({ height: 'high' });
  assert.ok(plansOf(events, 'KillEnemy').some((e) => e.actions.join() === 'BlindFireFromCover'));
  assert.ok(seenBullets.some((b) => b.blind), 'the arm gets blind bullets out past the wall');
});

test('it shouts while firing blind', () => {
  const { events } = underFire({ height: 'low' });
  assert.ok(ofType(events, 'bark').some((e) => e.text === 'Keep your head down!'));
});

// ---- dodging --------------------------------------------------------------------------

const aimAtEnemy = { aimX: 500, aimY: 400 };

test('with no cover, a gun aimed at the enemy makes it sidestep', () => {
  const { sim, enemy } = scenario({ crate: false });
  const events = run(sim, 40, aimAtEnemy);

  const dodge = plansOf(events, 'Dodge').find((e) => e.agentId === enemy.id);
  assert.deepEqual(dodge.actions, ['DodgeShuffle']);
  assert.ok(Math.abs(enemy.y - 400) > 15, `it moved out of the line (y = ${enemy.y})`);
  assert.ok(ofType(events, 'bark').some((e) => e.text === 'Look out!'));
});

test('it does not dodge non-stop', () => {
  const { sim, enemy } = scenario({ crate: false });
  const events = run(sim, 100, aimAtEnemy); // 1.7 s: under the 1.8 s cooldown
  assert.equal(plansOf(events, 'Dodge').filter((e) => e.agentId === enemy.id).length, 1);
});

test('it does not react to a gun aimed at it by someone it cannot see', () => {
  const { sim, player } = scenario({ crate: false });
  player.crouched = true; // crouched 300 away: beyond the 225 it can see a crouched target from
  const events = run(sim, 180, { ...aimAtEnemy, crouch: true });
  assert.equal(plansOf(events, 'Dodge').length, 0);
});

test('in cover, being aimed at makes it duck back behind the cover', () => {
  const { sim, world, enemy, brain } = scenario();
  run(sim, 200, aimUp); // settle into cover
  assert.ok(brain.coverNode);

  brain.memory.threatenedAt = world.time; // a gun swings round onto it
  brain.memory.dodgedAt = -Infinity;
  const events = run(sim, 30, aimUp);

  const dodge = plansOf(events, 'Dodge').find((e) => e.agentId === enemy.id);
  assert.deepEqual(dodge.actions, ['DodgeCovered'], 'the cheaper way: no sidestep in the open');
  assert.ok(ofType(events, 'bark').some((e) => e.text === 'Ducking!'));
});

// ---- repositioning ---------------------------------------------------------------------

test('when its cover stops hiding it, it picks new cover', () => {
  const { sim, world, player, enemy, brain } = scenario();
  run(sim, 200, aimUp); // settle behind the crate, on its east side
  const first = brain.coverNode;
  assert.ok(first && first.x > 560);

  // The player slips round to the east, and the enemy learns of it (say, from a shout):
  // the crate no longer hides the enemy from where the player is now.
  player.x = 700;
  player.y = 400;
  brain.memory.lastKnown = { id: player.id, x: 700, y: 400, time: world.time };
  assert.equal(isValidCover(world, first, player), false);

  const events = run(sim, 360, aimUp);
  assert.ok(plansOf(events, 'Cover').some((e) => e.agentId === enemy.id), 'it went looking for cover again');
  assert.ok(brain.coverNode && brain.coverNode !== first);
  assert.ok(brain.coverNode.x < first.x, `the new cover is round the other side (x = ${brain.coverNode.x}, was ${first.x})`);
  assert.ok(isValidCover(world, brain.coverNode, player));
});

// ---- and it all stays deterministic -------------------------------------------------------

test('the same seed gives the same fight, cover and all', () => {
  const log = () => {
    const { sim } = scenario({ accurate: false });
    return JSON.stringify(run(sim, 600, (i) => ({ moveY: i % 120 < 60 ? 0.5 : -0.5, aimX: 500, aimY: 400, fire: i % 90 < 10 })));
  };
  assert.equal(log(), log());
});
