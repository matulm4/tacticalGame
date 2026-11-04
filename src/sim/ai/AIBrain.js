import { REPLAN_RETRY, THREAT_MEMORY } from '../defs/tuning.js';
import { activeWeaponOf } from '../entities/Agent.js';
import { emptyIntent } from '../entities/Intent.js';
import { findCover, isValidCover } from './cover/CoverQuery.js';
import { ACTION_SETS } from './data/actionSets.js';
import { GOAL_SETS } from './data/goalSets.js';
import { AgentFSM } from './fsm/AgentFSM.js';
import { NodeRegistry } from './nav/NodeRegistry.js';
import { Perception } from './perception/Perception.js';
import { Planner } from './planning/Planner.js';
import { WorldState } from './planning/WorldState.js';

const AT_NODE_RADIUS = 28; // how close counts as "standing at" a node
const COVER_LEASH = 170; // farther than this from its cover (a peek goes up to 120, plus some overshoot), the agent has left it
const COVER_CACHE = 0.3; // seconds a cover search result is reused

/**
 * One agent's mind, the F.E.A.R. way:
 *
 *   senses -> memory -> world state
 *   goals compete by relevance; the best one that can be planned for wins
 *   the planner finds the cheapest chain of actions that reaches that goal
 *   each action puts the two-state FSM (Goto / Animate) to work
 *   the FSM produces this tick's Intent
 *
 * It re-plans only when it has to: when a more relevant goal appears, when the
 * current action stops being valid or fails, or when the plan runs out.
 */
export class AIBrain {
  /**
   * @param {object} options
   * @param {object} options.def     the agent's archetype (names its goal and action sets)
   * @param {{ x: number, y: number, angle: number }} options.home  where it is posted
   */
  constructor({ def, home }) {
    this.perception = new Perception();
    this.memory = this.perception.memory;
    this.fsm = new AgentFSM();
    this.planner = new Planner();
    this.goals = GOAL_SETS[def.goalSet]();
    this.actions = ACTION_SETS[def.actionSet]();

    this.nodes = new NodeRegistry();
    this.home = home;
    this.homeNode = this.nodes.add({ x: home.x, y: home.y, kind: 'home' });

    /** The plan being carried out: { goal, tag, steps, index }, or null. */
    this.plan = null;
    /** The cover position the agent has taken (or is peeking from), or null. */
    this.coverNode = null;
    /** Whether that cover hides it from the threat right now (as of the last tick; the squad reads it). */
    this.inCover = false;
  }

  /** Can this agent do `actionId` at all? (The squad only gives orders a member can carry out.) */
  can(actionId) {
    return this.actions.some((action) => action.id === actionId);
  }

  #nextPlanTime = 0;
  #lastGoalId = null; // the goal of the previous plan, so actions can tell "settling down" from "just spawned"
  #retryAt = new Map(); // goal id -> time before which it is not worth planning for again
  #coverCache = null;
  #lastNow = 0;

  /** One tick of thinking. Returns the Intent for this tick. */
  think(agent, world, dt) {
    this.perception.update(agent, world, dt);
    const ctx = this.#context(agent, world, dt);

    this.#advancePlan(ctx);
    ctx.order = this.memory.activeOrder(ctx.now); // an action may just have carried it out
    this.#chooseGoal(ctx);

    const intent = emptyIntent(agent.aimAngle);
    this.fsm.update(ctx, dt, intent);
    return intent;
  }

  /** A snapshot of what the brain is doing, for the debug overlays. */
  debugInfo() {
    const plan = this.plan;
    return {
      goal: plan?.goal.id ?? null,
      plan: plan ? plan.steps.map((step) => step.action.id) : [],
      step: plan?.index ?? -1,
      state: this.fsm.kind,
      path: this.fsm.state?.remainingPath ?? null,
      target: this.memory.target,
      lastKnown: this.memory.lastKnown,
      cover: this.coverNode ? { x: this.coverNode.x, y: this.coverNode.y } : null,
      order: this.memory.activeOrder(this.#lastNow)?.type ?? null,
    };
  }

  #context(agent, world, dt) {
    const threat = this.#threat(world);
    const ctx = {
      agent,
      world,
      dt,
      now: world.time,
      memory: this.memory,
      fsm: this.fsm,
      nodes: this.nodes,
      home: this.home,
      homeNode: this.homeNode,
      weapon: activeWeaponOf(agent),
      order: this.memory.activeOrder(world.time),
      goal: this.plan ? { id: this.plan.goal.id, tag: this.plan.tag } : null,
      previousGoalId: this.#lastGoalId,
      threat,
      coverNode: this.coverNode,
      inCover: false,
      settleInCover: (node) => {
        this.coverNode = node;
        ctx.coverNode = node;
        ctx.inCover = this.inCover = this.#inCover(ctx); // already true on arrival, so nothing re-plans a tick later
      },
      findCover: () => this.#findCover(ctx),
    };
    ctx.inCover = this.inCover = this.#inCover(ctx);
    if (this.coverNode) world.cover.reservations.claim(this.coverNode.id, agent.id, world.time); // holding it keeps it claimed
    this.#lastNow = world.time;
    return ctx;
  }

  /**
   * Who the agent is up against: a hostile in view, or one it saw within the
   * last few seconds (still alive, so probably hiding). Null when there is none.
   */
  #threat(world) {
    const { target, lastKnown } = this.memory;
    if (target) return { id: target.id, x: target.x, y: target.y, visible: true };
    if (lastKnown && world.time - lastKnown.time <= THREAT_MEMORY && world.getAgent(lastKnown.id)?.alive) {
      return { id: lastKnown.id, x: lastKnown.x, y: lastKnown.y, visible: false };
    }
    return null;
  }

  /** In cover = at its chosen cover (peeking counts) and that cover still hides it from the threat. */
  #inCover({ agent, world, threat }) {
    const node = this.coverNode;
    if (!node) return false;
    if (Math.hypot(agent.x - node.x, agent.y - node.y) > COVER_LEASH) {
      this.coverNode = null; // it has left
      return false;
    }
    return threat !== null && isValidCover(world, node, threat);
  }

  #findCover(ctx) {
    if (!ctx.threat) return null;
    if (this.#coverCache && ctx.now - this.#coverCache.time < COVER_CACHE) return this.#coverCache.result;
    const { reservations } = ctx.world.cover;
    const result = findCover(ctx, ctx.threat, {
      isTaken: (node) => reservations.isTaken(node.id, ctx.agent.id, ctx.now),
    });
    this.#coverCache = { time: ctx.now, result };
    return result;
  }

  /** How the world looks to this agent, in the planner's terms. */
  #worldState({ agent, memory, nodes, weapon, inCover, order, now }) {
    return WorldState.from({
      TargetVisible: memory.target !== null,
      TargetDead: false,
      WeaponLoaded: weapon.ammo > 0 && weapon.reloadLeft === 0,
      WeaponFull: weapon.ammo === weapon.def.magSize,
      Investigated: false,
      OnWatch: false,
      AtNode: nodes.nodeNear(agent.x, agent.y, AT_NODE_RADIUS),
      InCover: inCover,
      Threatened: memory.isThreatened(now),
      UnderFire: memory.isUnderFire(now),
      OrderPending: order !== null,
    });
  }

  /** Run the current action; move to the next step, or drop the plan if it cannot continue. */
  #advancePlan(ctx) {
    const plan = this.plan;
    if (!plan) return;

    const action = plan.steps[plan.index].action;
    if (!action.isStillValid(ctx)) return this.#endPlan(ctx);

    const status = action.update(ctx);
    if (status === 'failed') return this.#endPlan(ctx);
    if (status !== 'done') return;

    action.deactivate(ctx);
    plan.index++;
    if (plan.index >= plan.steps.length) {
      this.plan = null;
      this.fsm.stop();
      this.#retryAt.clear(); // the situation has likely changed: everything is worth another look
    } else {
      this.#activate(ctx, plan.steps[plan.index]);
    }
  }

  /** The plan cannot continue: drop it, and let every goal be tried again. */
  #endPlan(ctx) {
    this.#dropPlan(ctx);
    this.#retryAt.clear();
  }

  /** Pick the most relevant goal, and re-plan if it differs from the one being pursued. */
  #chooseGoal(ctx) {
    const ranked = this.goals
      .filter((goal) => (this.#retryAt.get(goal.id) ?? 0) <= ctx.now)
      .map((goal) => ({ goal, relevance: goal.relevance(ctx) }))
      .filter((entry) => entry.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance);

    if (this.plan) {
      // Stick with the current plan while its goal is still the most relevant (ties favor it).
      const current = ranked.find((entry) => entry.goal === this.plan.goal);
      if (current && current.relevance >= ranked[0].relevance) return;
    }
    if (ctx.now < this.#nextPlanTime) return;

    const worldState = this.#worldState(ctx);
    for (const { goal } of ranked) {
      const result = this.planner.plan(worldState, goal.goalState(ctx), this.actions, ctx);
      if (result && result.steps.length > 0) {
        if (this.plan && goal === this.plan.goal) return; // already doing it
        return this.#adopt(ctx, goal, result.steps);
      }
      // A goal that already holds, or that no plan can reach, falls through to the next one,
      // and is not tried again for a moment (so a more urgent but impossible goal cannot
      // make the agent restart its current plan every tick).
      this.#retryAt.set(goal.id, ctx.now + REPLAN_RETRY);
    }

    this.#dropPlan(ctx);
    this.#nextPlanTime = ctx.now + REPLAN_RETRY;
  }

  #adopt(ctx, goal, steps) {
    this.#dropPlan(ctx);
    ctx.previousGoalId = this.#lastGoalId;
    this.#lastGoalId = goal.id;
    this.plan = { goal, tag: goal.tag(ctx), steps, index: 0 };
    ctx.goal = { id: goal.id, tag: this.plan.tag };

    ctx.world.emit('planChanged', {
      agentId: ctx.agent.id,
      goalId: goal.id,
      actions: steps.map((step) => step.action.id),
    });
    this.#activate(ctx, steps[0]);
  }

  #activate(ctx, step) {
    step.action.activate(ctx, step.bindings);
    ctx.world.barks.say(ctx.world, ctx.agent, step.action.barkKeys(ctx), step.action.barkPriority);
  }

  #dropPlan(ctx) {
    if (this.plan) this.plan.steps[this.plan.index].action.deactivate(ctx);
    this.plan = null;
    this.fsm.stop();
  }
}
