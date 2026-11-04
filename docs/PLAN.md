# Implementation Plan: Top-Down Tactical Shooter with F.E.A.R.-style AI

Status: proposal, awaiting approval. Nothing is implemented yet.
Sources: the GDD (Phase 1 scope) and Orkin, *Three States and a Plan: The A.I. of F.E.A.R.* (GDC 2006).

## 0. Decisions already made

| Topic | Decision |
|---|---|
| Stack | Vanilla JavaScript (ES modules), Canvas 2D, no runtime dependencies, no build step |
| Tooling | Node 26 is installed. `node --test` for tests, a ~30-line `tools/serve.mjs` static server |
| Hits | Enemy: `hp` 1 (one hit). Player: `hp` 3. Rifle damage 1. HP is data on the agent archetype, so it can change later |
| Controls | WASD move, mouse aim, LMB fire, `R` reload, **hold Shift to crouch**, `Tab` editor/play |
| Debug colors | Sound waves: soft blue. Enemy vision cones: yellow |
| Flanking | Emergent (as in the paper). No flank-specific chatter |
| Chatter | In MVP. One line per action, shown as a bubble when the action activates |
| Extras | Plan overlay (current goal and plan over each enemy), planner and logic tests, frame-step/time-scale debug controls |
| Blind fire | A crouched enemy behind **low** cover may blind-fire: the gun goes over the top, so its bullets pass over low cover (large spread). The body stays crouched and hidden |
| Camera | Play mode is a close-up that follows the player (about 560 world units visible vertically, so only part of the map shows), stopping at the map edges. The editor shows the whole map. Player radius 18, aim line 9 units long, sticking out of the circle's edge only |
| Editor | The page opens in play mode; **Tab** switches to the editor and back, and the map being edited is the map that gets played. Changes autosave in the browser and are restored on the next visit; Save downloads a `.json` file, Open and Samples load maps. Enemy spawns are placed in the editor (choose the enemy type) and appear in play as living enemies |
| Enemies (M4) | Driven by the GOAP brain. Two archetypes with the SAME goals but DIFFERENT action sets, as in the paper: the **grunt** can walk (it walks to noises and to where it last saw you, looks around, returns to its post) and the **sentry** cannot (it turns to look instead; a goal it has no action for is skipped). Priorities: KillEnemy 60, Investigate 40, Rearm 30, ReturnToPost 25, Idle 1. Fights in bursts of three after a reaction time. A map with no enemies is a sandbox; with enemies, kill them all to win |
| Squads (M6) | Enemies near each other form **squads** (re-grouped every second; at most four; a squad busy with a behavior keeps its members). A squad shares what its members see, so one sighting alerts the rest (they treat it as a last known position). A free squad runs one coordinated **behavior** at a time: **getToCover** (when some are in the open: one keeps firing at the spot where you were seen while the others run to different cover positions), **advance** (a stand-off with everyone in cover: after a few seconds one fires while another moves up to cover closer to you, preferring routes out of your view, then they swap), and **search** (you have been out of sight for 5 s: the squad splits into pairs, one going to the last known spot, another to the far side of it). Behaviors work through **orders** (`goto-cover`, `suppress`, `search`), which an enemy follows ahead of its own fight/cover goals but not ahead of dodging. Two enemies never claim one cover position. Sentries can suppress but never move. Key `Q` shows squads, orders and the shared sighting. Flanking is still emergent: nothing asks for it |
| Cover (M5) | When an enemy sees (or just saw) you, it looks for **cover** and runs to it: a position behind a wall, found automatically around every obstacle, that really hides it from you. It hides crouched, and **peeks** to shoot: it stands up behind low cover, or steps along the wall past the corner of high cover, fires a burst, and ducks back. **Under fire** it fires **blind** instead (over low cover, or with its arm round the corner of high cover; very inaccurate). A gun aimed at it makes it **dodge** (a sidestep in the open, ducking back if it is in cover), at most every ~2 s and only if it can see who is aiming. If you move so its cover stops hiding it, it picks new cover. Cover is only used if the player can be seen from it (within sight range). Priorities: Dodge 85, Cover 65, KillEnemy 60, Investigate 40, Rearm 30, ReturnToPost 25, Idle 1. Sentries cannot walk, so they never use cover |
| Chatter (M4) | One line per action, shown as a bubble when the action starts (e.g. "Reloading!", "Lost sight! Checking it out!"). Combat callouts are never drowned out by idle chatter; an idle enemy is silent until it settles down after something happened |
| Debug overlays | `V` enemy view cones (yellow, clipped by walls, dashed arc at the crouched-target range), `N` sound rings (soft blue). Off by default; also toggled from the debug panel |
| Visual style | Light theme: white page, dark obstacles (high near-black, low a lighter gray that turns as dark as high cover while the player is crouched, so you can tell what you can see and shoot over), green player, red enemies. Game colors live only in `theme.js`; page chrome uses CSS variables in `main.css` |

## 1. Architecture rules

The code is split in four layers. Dependencies point downward only.

```
client   (browser only: DOM, canvas, input, UI, storage, later audio)
   |
editor   (editor logic: pure, no DOM)        sim   (game logic: pure, no DOM)
   \                                         /
                      core   (math, geometry, rng, events)
```

1. **`core/` and `sim/` never touch the browser.** No `document`, `window`, `canvas`, `performance.now`, `Date.now`, `Math.random`. Time comes from `world.time`, randomness from `world.rng` (seeded). An architecture test greps for these and for forbidden imports (`sim` may not import `client` or `editor`).
2. **The sim is deterministic and fixed-step (60 Hz).** Same map + seed + intents = same result. This gives headless tests, replays, a headless AI-vs-AI runner, and a server-side sim for multiplayer later.
3. **Everything that acts is driven by an `Intent`:** `{ moveX, moveY, aimAngle, fire, reload, crouch, ... }`. The player's controller reads input; an AI controller runs perception, planner and FSM. The sim cannot tell them apart. This is the seam for AI vs AI, network players and replays.
4. **The sim talks outward through events** (`shotFired`, `bulletHit`, `agentDamaged`, `agentDied`, `soundEmitted`, `bark`, `planChanged`, ...). The renderer, HUD and (Phase 2) audio only subscribe. Adding sound later requires zero sim changes.
5. **The renderer is read-only.** It draws `sim.world` and the event stream. Colors and styling live only in `client/render/theme.js`. Debug overlays read data the sim exposes through `sim/debug/DebugProbe.js`, so the yellow cone drawn is exactly the cone the AI uses.
6. **Content is data.** Weapons, agent archetypes, goal sets, action sets, barks, cover heights live in `sim/defs/` and `sim/ai/data/`. New enemy or weapon = new entry, not new engine code. This is the paper's "decoupled goals and actions" applied to our project.
7. **Conventions.** World units are pixels, y points down, angle 0 = +x, angles in radians, clockwise on screen. Default map is 1600x1000.

## 2. Folder and file plan

```
game/
├─ index.html
├─ package.json
├─ README.md
├─ docs/
│  └─ PLAN.md
├─ maps/
├─ styles/
├─ tools/
├─ src/
│  ├─ core/
│  ├─ sim/
│  ├─ editor/
│  └─ client/
└─ test/
```

### 2.1 Root

| File | Purpose |
|---|---|
| `index.html` | One canvas, HUD container, toolbar container, debug panel container. Loads `src/client/main.js` as a module |
| `package.json` | `"type": "module"`. Scripts: `start` (serve), `test` (`node --test`), `sim` (headless runner). No dependencies |
| `README.md` | How to run, controls, map format, how to add an enemy/weapon |
| `styles/main.css` | Layout, toolbar, HUD, debug panel. No game colors (those are in `theme.js`) |

### 2.2 `tools/`

| File | Purpose |
|---|---|
| `serve.mjs` | Dependency-free static server (needed because browsers block ES modules on `file://`) |
| `sim-cli.mjs` | Headless runner: loads a map, runs N seconds with a seed, prints an event summary. Used for regression checks, and becomes the AI-vs-AI harness |

### 2.3 `maps/` (sample content, JSON)

`arena.json` (open room, a few pillars), `pillars.json` (circle-heavy), `corridors.json` (walls with side routes, to see emergent flanking), `lowcover.json` (low and high cover mixed).

**Map format (version 1):**
```json
{
  "version": 1,
  "name": "arena",
  "width": 1600, "height": 1000,
  "obstacles": [
    { "id": "o1", "shape": "rect",   "x": 400, "y": 300, "w": 200, "h": 40, "height": "high" },
    { "id": "o2", "shape": "circle", "cx": 900, "cy": 500, "r": 40,        "height": "low" }
  ],
  "playerStart": { "x": 100, "y": 500, "angle": 0 },
  "spawns": [ { "id": "s1", "type": "grunt", "team": "enemy", "x": 1400, "y": 500, "angle": 3.14 } ]
}
```
`spawns` carries `type` (archetype id) and `team` from day one, so new enemy types and AI-vs-AI need no format change. Later additions (`waypoints`, `items`, `doors`) are new optional arrays, handled by `version` migration.

### 2.4 `src/core/` (pure utilities, no game knowledge)

| File | Purpose |
|---|---|
| `math.js` | `clamp`, `lerp`, `dist`, `angleDiff`, `normalizeAngle`, `rotateToward(angle, target, maxStep)`, vector helpers on `{x,y}` |
| `shapes.js` | Shape interface used by everything: `{ type, bounds, containsPoint, raycast, intersectsCircle, pushOutCircle }` (`raycast` returns the first-hit parameter along a segment). Implements `rect` (axis-aligned) and `circle`. Adding rotated rects or polygons later = one new entry here |
| `geometry.js` | Segment/segment, segment/circle, segment/rect, swept circle, ray-cast helpers built on `shapes.js` |
| `rng.js` | Seeded PRNG (mulberry32): `next()`, `range()`, `pick()`, `fork(label)` |
| `eventQueue.js` | Typed event queue. The sim `emit`s, consumers `drain()` or `subscribe()`. Events are plain serializable objects |
| `priorityQueue.js` | Binary heap, used by both A* searches |
| `FixedStepper.js` | Fixed-timestep accumulator: `advance(frameSeconds) -> {steps, alpha}` with frame clamp, spiral protection and time scale. Pure, so it is unit-tested and the same code can drive a server-side sim |

### 2.5 `src/sim/` (all game logic)

#### `sim/defs/` (data, no logic)
| File | Purpose |
|---|---|
| `tuning.js` | Global constants: tick rate 60, AI sensor rate 15 Hz, footstep interval, bullet speed, planner budget per tick |
| `weapons.js` | `rifle`: damage 1, mag 30, fire rate 10/s, reload 1.8 s, spread 2 deg (x1.0 crouched, grows while moving), bullet speed 900, muzzle offset, gunshot noise radius, `blindSpreadMult` (x4, used for blind fire). Fields `pellets` (default 1) and `auto` are there so shotgun/handgun are data-only additions |
| `agentTypes.js` | Archetypes `player` and `grunt`: `team`, `maxHp` (3 / 1), `radius`, `speed`, `crouchSpeedMult` (0.5), `crouchRadiusMult` (0.7), `weapon`, `footstepNoise` (walk/crouch), `vision {fov, range, crouchRangeMult}`, `hearing`, `reactionTime`, `turnRate`, `goalSet`, `actionSet` |
| `coverHeights.js` | `high`: blocks movement, sight, bullets. `low`: blocks movement, and blocks sight/bullets by the rule in section 3 |
| `teams.js` | Hostility matrix: `player`<->`enemy` hostile. Extra teams for AI vs AI are one more row |

#### `sim/map/`
| File | Purpose |
|---|---|
| `mapSchema.js` | `validateMap(json) -> {ok, errors, map}`, `createEmptyMap()`, `migrate(json)`. Used by the editor, the loader and tests |
| `StaticWorld.js` | Immutable level geometry built from a map: obstacle shapes, bounds, and queries: `raycast`, `segmentBlocked(a, b, stanceA, stanceB)`, `circleOverlaps`, `resolveCircleMove`. Linear scan first, behind an interface so a spatial grid can be swapped in |
| `coverRules.js` | The single function that decides whether an obstacle height blocks a segment given both endpoints' stances. Sight and bullets both call it, so the rule lives in one place. Takes a `blind` flag: a blind-fire bullet is treated as fired from a standing shooter, so it passes over low cover (the target's own crouch still counts) |

#### `sim/entities/`
| File | Purpose |
|---|---|
| `Agent.js` | Plain data: `id, typeId, team, pos, prevPos (for render interpolation), aimAngle, stance, hp, maxHp, alive, weapons[], activeWeapon, controller`. Effective radius derives from stance |
| `Bullet.js` | `pos, prevPos, vel, ownerId, team, damage, ttl, origin, blind` |
| `Intent.js` | Intent shape (`moveX, moveY, aimAngle, fire, blind, reload, crouch`), where `blind` is `null` or an arm-out offset (zero over low cover, sideways past the edge of high cover); `emptyIntent()`; clamping/normalization |

#### `sim/controllers/`
| File | Purpose |
|---|---|
| `PlayerController.js` | Holds the latest `PlayerInput` pushed in by the client (move axes, aim *world point*, buttons) and converts it to an `Intent` |
| `AIController.js` | Wraps the AI brain (section 2.6). `getIntent(agent, world, dt)` |
| `index.js` | `createController(kind, { def, home })` picks the controller an archetype names in its `ai` field (`'goap'`) and posts the agent where it spawned |
| (later) `NetworkController.js`, `ReplayController.js` | Same interface; not built now |

#### `sim/systems/` (run in a fixed order each tick)
| File | Purpose |
|---|---|
| `controllerSystem.js` | Asks every alive agent's controller for an `Intent` |
| `movementSystem.js` | Applies speed (crouch multiplier), circle-vs-obstacle collision with sliding, map bounds, soft agent-agent separation. Emits footstep `soundEmitted` events on a distance timer (walk vs crouch radius) |
| `stanceSystem.js` | Applies crouch intent and scales the effective radius. Standing up against a wall nudges the agent clear; it stays crouched only when there is truly no room (a gap narrower than the standing body) |
| `weaponSystem.js` | Fire-rate cooldown, magazine, reload timer, spread, spawns bullets (ray from agent center to muzzle first, so you cannot shoot through a wall you are touching). Blind shots (`intent.blind` set) fire from the arm-out muzzle point with spread x `blindSpreadMult` and tag the bullet `blind`. Emits `shotFired` and a gunshot `soundEmitted` |
| `projectileSystem.js` | Swept segment per bullet vs obstacles (via `coverRules`) and agent circles. Crouched agents have the smaller radius, so they are harder to hit. Emits `bulletHit` |
| `damageSystem.js` | `applyDamage(world, victim, amount, source)`: lowers `hp`, emits `agentDamaged` / `agentDied`. A `healthSystem` (regen, medkits) slots in next to it later |
| `soundSystem.js` | Delivers this tick's sounds (made with `world.emitSound`, which also emits the `soundEmitted` event) to the agents that can hear them, in `agent.heardSounds`. The radius is multiplied by each obstacle's `soundDampening` on the way (high x0.5, low x0.85). Ignores same-side sources, dead agents and agents without hearing |
| `squadSystem.js` | Lets the squad coordinator think (10 Hz) before the agents decide. (Each AI brain is ticked by `controllerSystem` through its `AIController`: sensors at 15 Hz, plan on demand, FSM every tick) |
| `rulesSystem.js` | Evaluates the active game rule, emits `matchEnded` |

#### `sim/rules/`
| File | Purpose |
|---|---|
| `EliminateEnemies.js` | MVP. A rule is `start(world)` + `update(world)`; it sets `world.result` and emits `matchEnded` once. Win when every enemy is dead (a map without enemies is a sandbox), lose when the player is dead |
| (later) `AIvsAI.js`, `Survival.js` | New modes are new files |

#### `sim/world/`
| File | Purpose |
|---|---|
| `World.js` | Mutable state container: `time`, `tick`, `static` (StaticWorld), `agents`, `bullets`, `sounds`, `cover` (`nodes`, `reservations`), `barks`, `squads` (the `SquadCoordinator`), `rng`, `events`, `rule` |
| `spawner.js` | Creates agents from map `playerStart` + `spawns` via `agentTypes` |
| `Simulation.js` | The public API the client uses: `new Simulation(map, {seed, rule})`, `step(dt)`, `setPlayerInput(input)`, `world`, `events`, `restart()`. Owns the system order |

#### `sim/ai/` (the F.E.A.R. part)

**`ai/AIBrain.js`** per-agent brain. Owns working memory, sensors, planner, current plan, FSM. Each tick: update sensors, rebuild world state, pick the highest-relevance goal, re-plan only when the goal changed, the plan became invalid, or an action failed (throttled), execute the plan, return an `Intent`. Plan execution (advance a step when its action is done, drop the plan when an action fails or is no longer valid) lives here; there is no separate runner. Goals that already hold, or that no plan can reach, fall through to the next goal.

**`ai/fsm/`** (the paper's "three states", here two)
| File | Purpose |
|---|---|
| `AgentFSM.js` | Holds the active state and its parameters; actions switch it |
| `GotoState.js` | Finds a path to `{x, y, arriveRadius}`, follows it (re-pathing up to twice if stuck), faces the way it walks. Status `arrived` or `failed`; exposes the path and the part still to walk |
| `AnimateState.js` | An in-place "animation": a `tick(ctx, elapsed, dt, intent)` function (fire a burst, reload, sweep the gaze, ...) that ends after a duration or when it returns true |

**`ai/planning/`** (GOAP)
| File | Purpose |
|---|---|
| `worldStateSchema.js` | The variable list, one fixed slot each. Built in M4: `TargetVisible, TargetDead, WeaponLoaded, WeaponFull, Investigated, OnWatch, AtNode`; M5 adds `InCover, Threatened, UnderFire`; M6 adds `OrderPending` (a squad order has not been carried out yet). Also the `UNSET` ("does not matter") and `PARAM` ("whatever the goal asks for") markers |
| `WorldState.js` | Fixed-size array of values (as in the paper, no add/delete lists), used for the full state and for partial states (goals, preconditions, effects). `from({...})`, `get`, `set`, `clone`, `key()`, `toObject()` |
| `Planner.js` | A* over world states, searching **regressively** from the goal: pick actions whose effects satisfy a need that is not yet true, turn their preconditions into new needs, stop when everything left holds in the current state. `PARAM` effects are bound to the value the goal asks for (how one `GotoNode` serves any node). Cost = sum of action costs. Runs `checkProceduralPreconditions` only for actions that otherwise fit. Expansion and depth caps prevent runaway searches |
| `Action.js` | Base class: `id, cost, preconditions, effects, barkPriority`; `checkProceduralPreconditions(ctx, bindings)` (while planning), `activate(ctx, bindings)` (puts the FSM to work: the paper's procedural effect), `update(ctx)` returning `running`/`done`/`failed`, `deactivate`, `isStillValid`, `barkKeys` |
| `Goal.js` | Base class: `id`, `priority`, `relevance(ctx)` (0 means not applicable), `goalState(ctx)`, optional `tag(ctx)` that picks a chatter line |

**`ai/goals/`** (one file each). Built in M4: `KillEnemy.js`, `Investigate.js`, `Rearm.js`, `ReturnToPost.js`, `Idle.js`. M5 adds `Cover.js` and `Dodge.js`; the paper's Ambush/reposition is not a separate goal: an agent's cover only counts while it still hides it from the threat, so when it stops hiding it the `Cover` goal fires again and picks new cover. M6 adds `FollowOrder.js` (goal state `OrderPending = false`; the action that fits the order does the work). Later: `Patrol` once the editor has waypoints.

**`ai/actions/`** (one file each). Built in M4: `Attack.js` (needs `TargetVisible` and `WeaponLoaded`), `Reload.js`, `InvestigatePoint.js` (walk there, then look around), `LookAtNoise.js` (turn to look; for agents that cannot walk), `GotoNode.js` (`AtNode = PARAM`), `LookAround.js`; `looking.js` has the shared sweep/look-at animations. M5 adds `AttackFromCover.js` (hide, peek, fire a burst, duck back; for an agent in cover that is not under fire), `BlindFireFromCover.js` (under fire; needs cover and, for high cover, a corner to reach round), `DodgeShuffle.js`, `DodgeCovered.js`; shared helpers `burst.js` (bursts of fire) and `coverMoves.js`. `Attack` is now for the open (it requires `InCover = false`). M6 adds the three order actions, each with `OrderPending = false` as its effect and a procedural precondition on the order type: `MoveToCover.js` (`goto-cover`), `SuppressFire.js` (`suppress`; needs `WeaponLoaded`, fires bursts at the ordered spot, blind from cover if it is in cover), `SearchPoint.js` (`search`). `grunt` has all three; `sentry` only `SuppressFire`.

**`ai/data/`**
| File | Purpose |
|---|---|
| `goalSets.js` | `soldier` goal set: which goals an archetype has, with their priorities |
| `actionSets.js` | `soldier` (everything) and `stationary` (no way to walk) action sets. A future melee or drone enemy = a different set reusing the same classes |

**`ai/memory/`**
| File | Purpose |
|---|---|
| `WorkingMemory.js` | Facts with timestamps: current target and since when it has been in view, last known position, last heard noise (with uncertainty), and what has already been investigated. `investigationPoint(now)` says where worth going (the newest unchecked noise or sighting, forgotten after 8 / 10 s). Blacklisted nodes, claimed cover and squad orders join later |

**`ai/perception/`**
| File | Purpose |
|---|---|
| `SightSensor.js` | Cone (FOV) + range + line of sight through `coverRules`; crouched targets shrink the effective range. Respects `reactionTime` |
| `HearingSensor.js` | Consumes `soundSystem` results, records a noise position with an uncertainty radius |
| `DangerSensor.js` | "Is this gun aimed at me" (aim within a few degrees or my body width, within range, line clear), checked only for a shooter the agent can see, and near-miss bullets (every tick). Feed `Threatened` and `UnderFire` |
| `TargetSelector.js` | The attention-selection subsystem the paper mentions: picks the single target the planner reasons about (nearest visible hostile, with stickiness) |
| `visionPolygon.js` | Ray fan clipped by obstacles. Used for the debug cone only, but shares the exact same geometry as `SightSensor` |
| `Perception.js` | One agent's senses together: takes in heard sounds every tick and looks (sight check, target selection) 15 times a second, writing to the agent's `WorkingMemory` |

**`ai/nav/`**
| File | Purpose |
|---|---|
| `NavGrid.js` | Rasterizes obstacles to a grid (20-unit cells, kept clear of walls by an agent's radius). 8-neighbor A* with no corner cutting. Built once per map and shared by restarts (built in M4, earlier than first planned: hunting needs it) |
| `pathSmoothing.js` | Line-of-sight string pulling using swept-circle checks |
| `PathFollower.js` | Steers along waypoints, notices when the agent is stuck |
| `NodeRegistry.js` | Named places an agent can plan to be at (its post now, cover positions later); `AtNode` holds a node's handle |

**`ai/cover/`**
| File | Purpose |
|---|---|
| `CoverGenerator.js` | Finds cover positions once per map (24 units out from every obstacle edge, 40 apart; circles get a ring), dropping ones an agent could not stand at. A position is `{ id, x, y, nx, ny, obstacleId, height }`. This replaces the designer-placed nodes of the paper |
| `CoverQuery.js` | `isValidCover` (the line to the threat is stopped by the very obstacle the position is behind, for a crouched agent), `peekPoint` (where to step to see the threat, within sight range), `findCover` (the best valid position: close, within sight range of the threat, with a peek spot, with a walkable route; only the best few are path-checked). `findCover` takes `isTaken(node)` (skip claimed positions) and `advance` (only cover closer to the threat, preferring routes out of its view); cover without a peek spot is no longer offered, since nothing can be done from it. `routeExposure` scores how much of a path the threat can see |
| `CoverReservations.js` | Who has claimed which cover position. A claim lapses after a few seconds unless its holder refreshes it (every agent heading for or sitting in cover does), so claims of the dead free themselves |

**`ai/squad/`**
| File | Purpose |
|---|---|
| `SquadCoordinator.js` | Periodically re-clusters same-team agents into squads by proximity (as in the paper). At most one behavior per squad at a time |
| `Squad.js` | Members, shared blackboard (shared target info so one sighting alerts nearby squadmates), active behavior |
| `Orders.js` | Order types: `goto-cover`, `suppress`, `search`: plain data with an expiry and a `fulfilled` flag, delivered into working memory; the `FollowOrder` goal (75) decides priority against self-preservation (a Dodge, 85, beats an order) |
| `behaviors/SquadBehavior.js` | Base: `plan` (which members take part, what orders), `start`, per-tick monitoring (done when the movers have carried out their orders; failed on timeout or when the suppressor dies), `end` (withdraws the orders). `pickSuppressor`: prefers a member already in cover, then one that sees the enemy |
| `behaviors/GetToCover.js` | One suppresses, the exposed others move to valid cover (each a different one) |
| `behaviors/AdvanceCover.js` | After a few seconds in a stand-off, one suppresses, the others (at most half) move to valid cover at least 70 units closer to the enemy; the farthest-back move first, so they leapfrog. With walls in between this produces the flanking look |
| `behaviors/Search.js` | When the enemy has been out of sight for 5 s (and up to 16 s): the squad splits into pairs, the nearest goes to the last known position, the next to the far side of it. Ends the moment anyone sees the enemy. Only once per sighting |
| (later) `OrderlyAdvance.js` | Single-file advance, the paper's fourth simple behavior |

**`ai/dialogue/`**
| File | Purpose |
|---|---|
| `barks.js` | `key -> ['line']`. One line per action for now (the array shape allows variants later). A key is the action id, or `Action:Goal` / `Action:tag` to say something different when the same action serves another goal or reason |
| `BarkSystem.js` | Emits `bark` events when an action activates, with per-agent, repeat and global cooldowns so bubbles do not spam; a line with a higher priority skips the agent's own cooldown. Lines are chosen after the decision, as in the paper |

#### `sim/debug/`
| File | Purpose |
|---|---|
| `DebugProbe.js` | Read-only snapshots on demand: vision polygons, per-agent goal/plan/path/cover/order, cover positions and whether they hide from the player, squads (members, behavior, orders, shared sighting). The client calls it only when an overlay is on, so there is no cost otherwise |

### 2.6 `src/editor/` (editor logic, pure, runs in Node)

| File | Purpose |
|---|---|
| `EditorState.js` | Working copy of the map, selection, active tool, grid size, snap flag, dirty flag. No DOM |
| `History.js` | Undo/redo stack of commands |
| `commands/` | `obstacleCommands.js` (`AddObstacle`, `RemoveObstacle`, `SetObstacleGeometry` for move and resize, `SetCoverHeight`), `spawnCommands.js` (`SetPlayerStart`, `AddSpawn`, `RemoveSpawn`, `SetSpawn` for move and turn), `ClearMap.js`. Each has `do(map)` / `undo(map)`. A drag applies its command live and records it once on release, so a whole drag is one undo step |
| `tools/Tool.js` | Interface: `pointerDown/Move/Up(worldPoint, modifiers)`, `preview()` returning ghost shape data, `cursor` hint |
| `tools/RectTool.js`, `CircleTool.js` | Drag to draw, snapping, minimum size |
| `tools/SelectTool.js` | Select, move, resize via handles, Delete key, cover-height toggle |
| `tools/PlacementTool.js`, `PlayerStartTool.js`, `EnemySpawnTool.js` | Click to place a marker (replacing the start, or adding a spawn of the chosen enemy type); drag before releasing to set the direction it faces |
| `hitTest.js` | Pointer to obstacle/spawn/handle, built on `core/shapes` |
| `snap.js` | Grid and angle snapping |
| `limits.js`, `transform.js` | Editor constants (minimum sizes, grid sizes, pointer tolerances); the move/resize geometry shared by the select tool and arrow-key nudging |
| `mapLint.js` | Errors (block playing): no player start, unknown enemy type. Warnings: start or spawn inside a wall or off the map, no enemies. Spawns unreachable from the player (via `NavGrid`) are added in M5 |

### 2.7 `src/client/` (browser only)

| File | Purpose |
|---|---|
| `main.js` | Entry point, creates `App` |
| `App.js` | Mode state machine (`editor` <-> `play`), canvas resize, map load, global hotkeys |
| `GameLoop.js` | `requestAnimationFrame` wrapper around `core/FixedStepper` (60 Hz): render interpolation `alpha`, pause, single-step, time scale, fps/tps stats |
| `modes/PlayMode.js` | Builds a `Simulation` from the current map, wires input, renderer, HUD, overlays; restart and end screens |
| `modes/EditorMode.js` | Wires mouse and keyboard through the camera into the `EditorState` (keys: V R C P E tools, H cover height, G snap, Delete, arrows to nudge, Esc, Ctrl/Cmd+Z / Shift+Z / Y / S); draws via `EditorRenderer` |
| `input/InputManager.js` | DOM listeners (keys, mouse, blur reset, `contextmenu` suppressed), polled state, screen to world through the camera |
| `input/keybindings.js` | Action to key list, read via `event.code` so Shift does not change which key is seen. Crouch = `ShiftLeft`, `ShiftRight` (hold). Rebinding-ready |
| `input/PlayerInputAdapter.js` | Builds the sim's `PlayerInput` from `InputManager` and `Camera` |
| `render/Camera.js` | World/screen transform with two modes: `follow` (close-up centered on the player, clamped to the map) for play, and `fit` (whole map, letterboxed) for the editor. Editor pan/zoom is added here only |
| `render/theme.js` | All colors and sizes: player green, enemy red, high obstacles near-black, low obstacles lighter, sound soft blue, vision yellow |
| `render/Renderer.js` | Draws layers in order using interpolated positions |
| `render/EventPresenter.js` | Turns sim events into visual-only state (muzzle flashes, hit sparks, death fades, sound rings, bubble timers) |
| `render/layers/TerrainLayer.js` | Background, grid, obstacles. Low cover is drawn lighter and, while the player is crouched, dimmed further |
| `render/layers/AgentLayer.js` | Circle + a short aim line that sticks out of the circle's edge (never drawn inside it). Crouched agents drawn smaller and darker. HP pips for the player; for enemies only when `maxHp > 1` |
| `render/layers/BulletLayer.js` | Bullets / short tracers |
| `render/layers/EffectsLayer.js` | Muzzle flash, hit sparks, death fade |
| `render/layers/CrosshairLayer.js` | Cross reticle at the mouse; OS cursor hidden in play |
| `render/layers/BubbleLayer.js` | Chatter bubbles above enemies; follow the speaker and fade after ~2 s |
| `render/overlays/VisionOverlay.js` | Enemy vision cones in yellow |
| `render/overlays/SoundOverlay.js` | Expanding soft-blue rings from `soundEmitted` events |
| `render/overlays/PlanOverlay.js` | Under each enemy: its goal and plan, with the current step in brackets. On the ground: the path still to walk, a line to the target it sees, a ring at the last known position (purple). Key `P` |
| `render/overlays/SquadOverlay.js` | Per squad (own color): spokes from a hub (filled while it runs a behavior, labelled with it) to its members, each member's order, a cross where the squad thinks the enemy is (dashed if only the last known spot). Key `Q` |
| `render/overlays/CoverOverlay.js` | Every cover position as a dot: green where it would hide an agent from the player right now, faint where not; a ring round the cover each enemy has taken. Key `C` |
| `render/overlays/NavGridOverlay.js` | Debug (later): blocked cells |
| `render/EditorRenderer.js` | The terrain plus `layers/EditorLayer.js`: snap grid, player start and spawn markers, the active tool's ghost, selection with its handles |
| `ui/Hud.js` | Ammo/magazine, reload loading bar, player hit points |
| `ui/DebugPanel.js` | Overlay toggles (`V` vision, `N` noise, `P` plan, `C` cover, `Q` squads), pause/step, time scale, restart. Toggle state lives in `DebugFlags.js` |
| `ui/Screens.js` | End-of-match overlay ("Area cleared" / "You died") with Restart (Enter) and Editor (Tab) |
| `ui/EditorToolbar.js` | Tool buttons, cover height toggle, grid snap, undo/redo, save/load/new, play |
| `ui/Screens.js` | Win / lose / pause overlays |
| `storage/MapStorage.js` | `localStorage` autosave, JSON download, JSON file upload, fetch sample maps from `/maps` |

(Phase 2: `client/audio/AudioManager.js` subscribing to events. Not created in the MVP.)

### 2.8 `test/` (`node --test`, zero dependencies)

Shared helpers live in `test-support/` (outside `test/`, so `node --test` does not run them as tests).

| File | What it locks down |
|---|---|
| `architecture.test.js` | `core`/`sim`/`editor` contain no browser APIs, `Date.now`, `Math.random`; layer import directions are respected |
| `core/geometry.test.js` | Segment/circle/rect intersections, swept circle, push-out |
| `sim/mapSchema.test.js` | Validation, migration, rejects bad shapes |
| `sim/coverRules.test.js` | The sight/bullet rule matrix (stance x height), including blind-fire bullets passing over low cover but not high |
| `sim/weapon.test.js` | Magazine, reload, fire rate, spread bounds |
| `sim/damage.test.js` | Enemy dies in 1 hit, player survives 2 and dies on the 3rd, bullets blocked by walls |
| `sim/vision.test.js` | Cone, range, crouched range, LOS through high and low cover |
| `sim/hearing.test.js` | Footstep vs crouch radius, wall attenuation, same-team ignore |
| `sim/navGrid.test.js` | Paths around obstacles, no corner cutting, smoothing |
| `sim/worldState.test.js` | Satisfaction, variable references, key hashing |
| `sim/planner.test.js` | Chains (`Attack` needs `WeaponLoaded`, `Reload` provides it), cheapest plan chosen, unsatisfiable goal, procedural precondition failure falls back to another action |
| `sim/cover.test.js` | Valid/invalid cover for a threat, reservations |
| `sim/squad.test.js` | Clustering, shared sightings, cover reservations, each behavior's start, outcome and orders, sentries, determinism |
| `sim/orders.test.js` | Orders in memory, planning for each order type (and what a sentry cannot do), priorities, claims, bark priority, squad probe |
| `sim/scenario.test.js` | Headless runs: enemy kills a stationary player; identical seeds produce identical event logs |
| `editor/commands.test.js`, `editor/tools.test.js` | Undo/redo and tools driven by synthetic pointer events |

## 3. Key rules and how the pieces interact

**Cover height rule (one function in `coverRules.js`).** A high obstacle always blocks a segment (sight or bullet). A low obstacle blocks a segment if *either end is crouched*. So standing agents see and shoot each other over low walls; anyone crouched behind a low wall is hidden, and also cannot see or shoot over it. To fire from low cover you stand up, then duck again. Both heights block movement. **One exception, blind fire:** a crouched enemy behind low cover can hold the gun over the top without standing. Those bullets (`blind`) pass over low cover, with large spread. High cover still stops them, and a crouched target behind its own low cover is still protected.

**AI cover cycle.** Cover nodes are generated per obstacle. A node is *valid* against a threat if the segment node-to-threat is blocked for the stance used there. At a low-cover node the enemy stays crouched. `AttackFromCover` stands (low) or steps to a peek point beside the obstacle edge (high), fires a burst, then returns. `BlindFireFromCover` keeps the body hidden and fires with large spread. Behind low cover the enemy stays crouched and the gun goes over the top (zero arm offset; the bullets pass over the low wall). Behind high cover the gun goes around the corner from an arm-out muzzle point.

**World state to behavior.** `WorkingMemory.toWorldState()` fills the fixed array; the highest-relevance goal is chosen; the planner returns e.g. `[GotoNode(cover), AttackFromCover]`; `PlanRunner` activates each action, which sets `GotoState` or `AnimateState` parameters; the FSM outputs an `Intent`; the same systems that run the player run the enemy.

**Goal priorities** (tunable, in `goalSets.js`): Dodge 85, FollowOrder 75, Cover 65, KillEnemy 60, Investigate 40, Rearm 30, ReturnToPost 25, Idle 1.

**Planner cost.** A* with cost per action; heuristic = number of unsatisfied variables x minimum action cost, so it stays admissible. State is about a dozen variables and depth rarely exceeds 4, so planning is cheap. There is still a per-tick planning budget and a re-plan throttle per agent.

**Chatter.** `BarkSystem` reacts to action activation, picks the action's single line, and emits `bark`. A cooldown per agent and a global one stop overlapping bubbles. The bubble is purely a client visual.

## 4. Build order (each milestone ends with something you can run)

| # | Milestone | Result |
|---|---|---|
| M0 | Scaffolding: `package.json`, serve script, `index.html`, `GameLoop`, `Camera`, `theme`, architecture test | Empty arena renders in the browser at a steady fixed step |
| M1 | Core + player: `core/*`, map schema, `StaticWorld`, movement and collision, aiming, crosshair, crouch, weapon, bullets, HUD, a hand-written map | Playable movement and shooting against walls, no enemies |
| M2 | Editor: `editor/*`, `EditorMode`, toolbar, save/load, `Tab` to play | Draw a map, play it, save/load it |
| M3 | Agents, hits and perception: damage and HP, stationary enemies, sight and hearing sensors, yellow vision and blue sound overlays, win/lose | Enemies that notice and die in one hit, player dies in three |
| M4 (done) | GOAP core: world state, planner, FSM, `KillEnemy`/`Investigate`/`Rearm`/`ReturnToPost`/`Idle`, path finding (`NavGrid`, pulled forward from M5), `grunt` and `sentry`, plan overlay, barks, planner tests | Enemies hunt and shoot with planned behavior; plans visible |
| M5 (done) | Cover: cover generation, `Cover`, `AttackFromCover`, `BlindFire`, `Dodge` (reposition folded into `Cover`), cover overlay | Enemies use cover and fire from it |
| M6 (done) | Squads: coordinator, `GetToCover`, `AdvanceCover`, `Search`, orders, shared sightings, cover reservations, squad overlay | Coordinated suppression, leapfrogging advances and split-up searches (shown on `maps/crossfire.json`, built for it; `corridors.json` was not built) |
| M7 | Polish: effects, tuning pass, sample maps, `sim-cli`, README | MVP complete |

## 5. Where Phase 2 and later features plug in

| Feature | Where it goes | Core change needed |
|---|---|---|
| Audio (gunfire, footsteps, cues) | New `client/audio/AudioManager.js` subscribing to `shotFired`, `soundEmitted`, `agentDied`, ... | None in the sim |
| Handgun, shotgun | New entries in `defs/weapons.js` (`pellets`, tighter spread); weapon switch field on `Intent`, number keys in `keybindings.js` | `weaponSystem` already reads `activeWeapon` from an array |
| Healing, medkits | `Pickup` entity, `pickupSystem`, `healthSystem`, map `items` array, `use` on `Intent` | New systems only; `hp`/`maxHp` already exist |
| Richer chatter, taunts, two-enemy exchanges | `barks.js` gains arrays/conditions; a `DialogueDirector` listening to squad-behavior events | Extends `ai/dialogue/` only |
| New enemy types | New archetype + goal/action sets; reuse existing action classes | Data only (the paper's decoupling) |
| AI vs AI | Teams in `teams.js`, `rules/AIvsAI.js`, a spectator mode in `PlayMode`, `sim-cli` already runs headless | No player agent required: `Simulation` does not depend on one |
| Multiplayer | `NetworkController`, snapshot/intent messages; the same sim runs in Node as the server | Sim is already deterministic and DOM-free |
| Rotated rects, polygons, new obstacle kinds | New shape in `core/shapes.js`; editor tool; schema entry | Nothing else touches concrete shapes |
| Patrol routes | `waypoints` in map, `Patrol` goal + `GotoNode` reuse, editor tool | Additive |
| Larger maps with scrolling/zoom | `Camera` only | None |
| Fog of war / player vision | Renderer layer using the existing visibility code | None |
| Replays | Record seed + per-tick intents, feed through `ReplayController` | None |
| Key rebinding UI | `keybindings.js` is already a table | UI only |
| Grenades (stashed, not scheduled) | New `Grenade` entity with a hidden height for a ballistic arc, bounces off walls and high cover, a timed blast of radius R that does 3 damage where there is line of sight; `grenadeSystem`; `throwGrenade` on `Intent`, a hotkey in `keybindings.js`. AI: a `ThrowGrenade` action (a trajectory solver picks the aim and power) and a `FleeBlast` goal. Estimated at M3-size for the player alone, M5-size with enemies. Open: count per agent, friendly fire, blast through walls, fuse, range | `Intent` field, new entity and system; AI is additive |

## 6. Risks and open details

1. **Crouch key.** Shift avoids the browser shortcuts that made Ctrl a bad choice (Ctrl+W closes the tab, Mac Control+click is a right-click). Keys are read by `event.code`, and all held keys are cleared on window blur so crouch cannot stick.
2. **Cover rule.** Confirmed: a crouched shooter cannot fire over low cover, with blind fire as the one exception. It is one function (`coverRules.js`), easy to change.
3. **Blind fire geometry** (arm-out muzzle) and **peek points** are the fiddliest parts of M5; I will prototype them on `lowcover.json` before building the squad layer on top.
4. **Planner throughput.** Many enemies re-planning in the same frame can spike; covered by the budget and throttle, and checked with `sim-cli` timing.
5. **Initial tuning numbers** (speeds, ranges, spread, goal priorities) are guesses; they all live in `defs/` and `goalSets.js` so a tuning pass never touches logic.
