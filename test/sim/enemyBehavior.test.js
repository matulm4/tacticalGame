import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../../src/sim/world/Simulation.js';
import { makeAccurate, makeMap, ofType, rect, run, spawn } from '../../test-support/sim.js';

// Whole enemies, thinking with the real GOAP brain through the real senses.
// By default one enemy stands at (450, 400) facing -x, 350 units from the player at (100, 400).
// 'sentry' is the enemy that cannot walk; 'grunt' can.
function scenario({ type = 'sentry', obstacles = [], enemy = {}, accurate = true } = {}) {
  const at = { x: 450, y: 400, angle: Math.PI, ...enemy };
  const sim = new Simulation(
    makeMap({ obstacles, spawns: [spawn('e', at.x, at.y, { type, angle: at.angle })] }),
    { seed: 1 },
  );
  const [player, enemyAgent] = sim.world.agents;
  if (accurate) makeAccurate(enemyAgent);
  return { sim, player, enemy: enemyAgent, brain: enemyAgent.controller.brain };
}

const shotsBy = (events, agent) => ofType(events, 'shotFired').filter((e) => e.agentId === agent.id);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---- fighting ------------------------------------------------------------------

test('an enemy that sees the player waits out its reaction time, then kills them in three hits', () => {
  const { sim, player, enemy } = scenario();
  const events = run(sim, 180);

  const [first] = shotsBy(events, enemy);
  assert.ok(first, 'the enemy opened fire');
  assert.ok(first.time >= enemy.def.reactionTime, `first shot at ${first.time}`);

  assert.equal(ofType(events, 'agentDamaged').filter((e) => e.agentId === player.id).length, 3);
  assert.equal(player.alive, false);
  assert.deepEqual(ofType(events, 'matchEnded').map((e) => e.outcome), ['lose']);
});

test('it fights in bursts of three with a pause between them', () => {
  const { sim, player, enemy } = scenario();
  player.hp = player.maxHp = 1000; // survive long enough to watch
  const times = shotsBy(run(sim, 360), enemy).map((e) => e.time);

  const bursts = [[times[0]]];
  for (let i = 1; i < times.length; i++) {
    if (times[i] - times[i - 1] > 0.5) bursts.push([]);
    bursts.at(-1).push(times[i]);
  }

  assert.ok(bursts.length >= 3, `saw ${bursts.length} bursts`);
  for (const burst of bursts.slice(0, -1)) assert.equal(burst.length, 3);
  for (let i = 1; i < bursts.length; i++) {
    assert.ok(bursts[i][0] - bursts[i - 1].at(-1) >= 0.6, 'a pause separates bursts');
  }
});

test('an empty weapon makes it plan "reload, then attack", and it fights once reloaded', () => {
  const { sim, enemy, brain } = scenario();
  enemy.weapons[0].ammo = 0;
  const events = run(sim, 160);

  const plan = ofType(events, 'planChanged').find((e) => e.agentId === enemy.id && e.goalId === 'KillEnemy');
  assert.deepEqual(plan.actions, ['Reload', 'Attack']);

  const [first] = shotsBy(events, enemy);
  assert.ok(first.time >= enemy.weapons[0].def.reloadTime, `fired at ${first.time}, before the reload finished`);
  assert.ok(brain, 'the brain is reachable for inspection');
});

test('running dry in the middle of a fight sends it back to reload', () => {
  const { sim, player, enemy } = scenario();
  player.hp = player.maxHp = 1000;
  enemy.weapons[0].ammo = 4; // one full burst and one round more

  const events = run(sim, 240);
  assert.ok(ofType(events, 'reloadStarted').some((e) => e.agentId === enemy.id));
  assert.ok(shotsBy(events, enemy).length > 4, 'it kept fighting afterwards');
});

test('with nothing in view and the magazine part empty, it tops up', () => {
  const { sim, enemy } = scenario({ enemy: { angle: 0 } });
  enemy.weapons[0].ammo = 10;
  const events = run(sim, 30);
  assert.ok(ofType(events, 'reloadStarted').some((e) => e.agentId === enemy.id));
  const plan = ofType(events, 'planChanged').find((e) => e.goalId === 'Rearm');
  assert.deepEqual(plan.actions, ['Reload']);
});

// ---- not noticing ------------------------------------------------------------------

test('an enemy facing away does not notice a silent player', () => {
  const { sim, player, enemy } = scenario({ enemy: { angle: 0 } });
  const events = run(sim, 180);
  assert.equal(shotsBy(events, enemy).length, 0);
  assert.equal(player.hp, 3);
});

test('a crouched player stays unseen at a distance where a standing one is spotted', () => {
  const enemy = { x: 400 }; // 300 away: beyond the crouched sight range of 225
  const standing = scenario({ enemy });
  assert.ok(shotsBy(run(standing.sim, 180), standing.enemy).length > 0);

  const crouched = scenario({ enemy });
  const events = run(crouched.sim, 180, { crouch: true });
  assert.equal(shotsBy(events, crouched.enemy).length, 0);
  assert.equal(crouched.player.hp, 3);
});

test('a high wall protects the player, a low wall protects only a crouched player', () => {
  const wall = (height) => [rect('wall', 250, 300, 20, 200, height)];

  const high = scenario({ obstacles: wall('high') });
  assert.equal(shotsBy(run(high.sim, 180), high.enemy).length, 0);

  const lowStanding = scenario({ obstacles: wall('low') });
  assert.ok(shotsBy(run(lowStanding.sim, 180), lowStanding.enemy).length > 0);
  assert.ok(lowStanding.player.hp < 3, 'a standing player is shot over low cover');

  const lowCrouched = scenario({ obstacles: wall('low') });
  const events = run(lowCrouched.sim, 180, { crouch: true });
  assert.equal(shotsBy(events, lowCrouched.enemy).length, 0);
  assert.equal(lowCrouched.player.hp, 3);
});

// ---- hearing: sentry vs grunt: same goals, different actions ----------------------

const shootStraightUp = (i) => ({ fire: i === 0, aimX: 100, aimY: 0 }); // the shot harms nobody

test('a sentry hears a shot behind it, turns round, spots the player and opens fire', () => {
  const { sim, enemy } = scenario({ enemy: { angle: 0 } });
  const events = run(sim, 300, shootStraightUp);

  const plan = ofType(events, 'planChanged').find((e) => e.goalId === 'Investigate');
  assert.deepEqual(plan.actions, ['LookAtNoise'], 'it cannot walk, so it just looks');

  const shots = shotsBy(events, enemy);
  assert.ok(shots.length > 0);
  assert.ok(Math.abs(Math.abs(shots[0].angle) - Math.PI) < 0.1, `fired at ${shots[0].angle}`);
});

test('a sentry never leaves its post, however much noise there is', () => {
  const { sim, enemy } = scenario({ enemy: { angle: 0 } });
  run(sim, 300, shootStraightUp);
  assert.deepEqual([enemy.x, enemy.y], [450, 400]);
});

test('the same noise makes a grunt walk toward it, until it sees the player', () => {
  // 550 away: heard (gunshots carry 600) but beyond sight (450), so it has to go and look.
  const { sim, player, enemy } = scenario({ type: 'grunt', enemy: { x: 650, angle: 0 } });
  const start = { x: enemy.x, y: enemy.y };
  const events = run(sim, 60, shootStraightUp);

  const plan = ofType(events, 'planChanged').find((e) => e.agentId === enemy.id && e.goalId === 'Investigate');
  assert.deepEqual(plan.actions, ['InvestigatePoint'], 'it walks there (the cheaper way)');
  assert.ok(distance(enemy, player) < distance(start, player) - 40, 'it closed in on the noise');

  const all = [...events, ...run(sim, 120)];
  const goals = ofType(all, 'planChanged').filter((e) => e.agentId === enemy.id).map((e) => e.goalId);
  assert.ok(goals.indexOf('KillEnemy') > goals.indexOf('Investigate'), `and then it spotted the player: ${goals}`);
});

test('a grunt that lost sight of someone goes to the last place it saw them, looks around, then returns to its post', () => {
  const { sim, player, enemy, brain } = scenario({ type: 'grunt', enemy: { x: 500, angle: 0 } });
  // The player crouches at a distance where the grunt cannot see them, and stays silent.
  brain.memory.lastKnown = { id: player.id, x: 700, y: 400, time: 0 };

  let farthest = 0;
  const events = [];
  for (let i = 0; i < 540; i++) {
    events.push(...run(sim, 1, { crouch: true }));
    farthest = Math.max(farthest, enemy.x);
  }

  // It stops within 24 units of the spot (its arrival radius).
  assert.ok(farthest > 670, `it walked to the last known position (reached x = ${farthest})`);
  assert.ok(distance(enemy, { x: 500, y: 400 }) < 40, 'and came back to its post');
  assert.equal(brain.debugInfo().goal, 'Idle');

  const goals = ofType(events, 'planChanged').map((e) => e.goalId);
  assert.deepEqual(goals.slice(0, 2), ['Investigate', 'ReturnToPost']);

  const words = ofType(events, 'bark').map((e) => e.text);
  assert.ok(words.includes('Lost sight! Checking it out!'));
  assert.ok(words.includes('Back to my post.'));
});

test('a goal the agent has no action for is skipped: a sentry away from its post just stays on watch', () => {
  const { sim, enemy, brain } = scenario({ enemy: { angle: 0 } }); // facing away from the player
  enemy.x = 300; // 150 from its post
  run(sim, 60);

  assert.equal(brain.debugInfo().goal, 'Idle', 'ReturnToPost cannot be planned without GotoNode');
  assert.equal(enemy.x, 300);
});

// ---- chatter, plans and determinism -----------------------------------------------

test('enemies say what they are doing', () => {
  const { sim, enemy } = scenario();
  enemy.weapons[0].ammo = 0;
  const events = run(sim, 160);

  const barks = ofType(events, 'bark').filter((e) => e.agentId === enemy.id);
  assert.equal(barks[0].text, 'Reloading!');
  assert.ok(barks.some((e) => e.text === 'Opening fire!'));
  assert.ok(barks.every((e) => e.x === enemy.x && e.y === enemy.y));
});

test('an idle enemy is quiet at first, and remarks on the calm only after something has happened', () => {
  const quiet = scenario({ enemy: { angle: 0 } });
  const calm = run(quiet.sim, 120);
  assert.equal(ofType(calm, 'bark').length, 0, 'nothing to say on a quiet start');

  const { sim } = scenario({ enemy: { angle: 0 } });
  const events = run(sim, 600, shootStraightUp); // a noise, then a fight, then the player is dead and it settles
  const words = ofType(events, 'bark').map((e) => e.text);
  assert.ok(words.includes('Did you hear that?'));
  assert.ok(words.includes('Opening fire!'));
});

test('every new plan is announced with its goal and its actions', () => {
  const { sim, enemy } = scenario({ enemy: { angle: 0 } }); // starts idle, facing away
  const events = run(sim, 300, shootStraightUp);
  const plans = ofType(events, 'planChanged').filter((e) => e.agentId === enemy.id);

  assert.deepEqual(plans.slice(0, 3).map((e) => [e.goalId, e.actions.join()]), [
    ['Idle', 'LookAround'],
    ['Investigate', 'LookAtNoise'],
    ['KillEnemy', 'Attack'],
  ]);
});

test('what the brain is doing can be inspected', () => {
  const { sim, brain } = scenario();
  run(sim, 40);
  const info = brain.debugInfo();
  assert.equal(info.goal, 'KillEnemy');
  assert.deepEqual(info.plan, ['Attack']);
  assert.equal(info.step, 0);
  assert.equal(info.state, 'animate');
  assert.ok(info.target);
});

test('the same seed gives the same fight', () => {
  const log = () => {
    const { sim } = scenario({ type: 'grunt', accurate: false });
    return JSON.stringify(run(sim, 300, (i) => ({ moveY: i % 120 < 60 ? 1 : -1 })));
  };
  assert.equal(log(), log());
});
