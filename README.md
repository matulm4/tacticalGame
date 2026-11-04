# Tactical Shooter

Top-down tactical shooter in vanilla JavaScript (Canvas 2D) with F.E.A.R.-style
GOAP enemy AI, after Jeff Orkin's *Three States and a Plan*. No dependencies and no
build step. Node is only used for the dev server and tests.

The full design and file-by-file plan is in [docs/PLAN.md](docs/PLAN.md).

## Run

```bash
npm start
```

Then open http://localhost:5173. (A server is needed because browsers block ES
modules on `file://`.)

## Play

| Input | Action |
|---|---|
| `W` `A` `S` `D` | Move |
| Mouse | Aim (cross reticle); the camera is a close-up that follows the player |
| Left mouse button | Fire (hold for automatic fire) |
| `R` | Reload (an empty magazine also reloads on trigger pull); ammo is unlimited |
| Hold `Shift` | Crouch: smaller, slower, quieter, hides behind low cover. Low cover is light while you stand and turns dark (like high cover) while you crouch |
| `V` / `N` / `P` / `C` / `Q` | Debug overlays: enemy view cones (yellow) / sound rings (soft blue) / what each enemy wants and plans to do (purple) / cover positions (green hides from you) / squads, their orders and what they know |
| `Enter` | Restart, once the match is over |
| `Tab` | Switch to the map editor |

**Enemies.** Place enemy spawns in the editor and pick a type. Enemies think with
goal-oriented action planning (the F.E.A.R. approach): they have goals (fight, investigate,
reload, return to post, idle) and actions, and a planner works out the cheapest chain of
actions that reaches the most pressing goal, re-planning when things change. Press `P` to
watch their goals and plans, and watch the speech bubbles for what they are doing.

- **Grunt** can walk. It goes to noises it hears and to where it last saw you, looks around
  there, then returns to its post.
- **Sentry** has the same goals but cannot walk, so it turns to look at things instead.

Grunts **use cover**. When one sees you it runs behind a wall that hides it (found
automatically around every obstacle), crouches there, and **peeks** to shoot: standing up
behind low cover, or stepping past the corner of high cover, firing a burst, then ducking
back. If you shoot at it, it fires **blind** over the top or round the corner (inaccurate
but it keeps you honest). A gun aimed at it makes it **dodge**. If you move so its cover no
longer hides it, it picks new cover. So don't stand in the open: flank them, or wait them out.

**Squads.** Enemies that stand near each other form squads and work together (press `Q` to see them). One sighting alerts the whole squad. When some of them are in the open, one keeps firing at where you were while the others run to different cover. In a stand-off one covers while another moves up to closer cover, then they swap, so a patient squad works its way toward you, taking routes out of your sight where it can. When you vanish, the squad splits into pairs and searches the last place you were seen from two sides. Two enemies never take the same cover. Sentries join in by firing, but never move.

The **Crossfire** sample map is built to show squads: you start at the west end; a squad of four grunts and a sentry holds the east yard behind low walls, pillars and a crate. A big block in the middle splits the way into a north and a south lane. Stand in a lane within sight of the yard, press `Q`, and watch them take cover, then leapfrog forward from cover to cover (round the block, down the lane) while one of them fires at where you were. Slip away west and they split up to search.

Both see in a 110 degree cone out to 450 units, but only half as far if you are crouched, and
low cover hides a crouched player. Footsteps carry 140 units (60 crouched), gunshots 600, and
walls muffle both. Once an enemy has spotted you it reacts, then fires bursts of three.
Enemies die in one hit and you in three. Kill every enemy to win; a map with no enemies is
just a sandbox.

The debug panel (top right) shows fps and ticks per second, can pause, single-step or slow
the simulation, restart the match, and switch the overlays. From the browser console,
`game.sim` is the running simulation.

## Edit maps

`Tab` switches between playing and editing; the map you edit is the map you play. Your
changes are saved in the browser automatically and restored next time. **Save** downloads
the map as a `.json` file, **Open** loads one, **Samples** loads the maps from `maps/`,
and **New** starts empty.

| Key | Action |
|---|---|
| `V` / `R` / `C` | Select / draw a rectangle / draw a circle |
| `P` / `E` | Place the player start / an enemy spawn (drag before releasing to set the direction) |
| `H` | Toggle cover height: **high** blocks sight and bullets, **low** can be seen and shot over while standing |
| `G` | Snap to the grid (hold `Alt` while dragging to turn snapping off) |
| `Delete` | Remove the selection |
| Arrow keys | Nudge the selection one grid step |
| `Shift` | Draw a square; snap a spawn's direction to 15 degrees |
| `Esc` | Cancel a drag, then deselect, then back to the select tool |
| `Ctrl/Cmd+Z`, `+Shift+Z` | Undo, redo |
| `Ctrl/Cmd+S` | Save |

With a shape selected, drag it to move it and drag a handle to resize it. A map needs a
player start before it can be played; the toolbar shows other problems (such as a spawn
inside a wall) as warnings.

## Test

```bash
npm test
```

## Layout

| Folder | Role |
|---|---|
| `src/core` | Pure utilities (math, geometry, shapes, RNG, event queue, fixed-step accumulator) |
| `src/sim` | Game logic. No DOM, deterministic, fixed 60 Hz |
| `src/editor` | Editor logic (tools, commands, undo). No DOM |
| `src/client` | Browser only: rendering, input, UI, storage |
| `maps` | Level JSON files (`index.json` lists the samples) |
| `test` | `node --test` suites, including an architecture guard |
| `test-support` | Helpers shared by the simulation and editor tests |

## Status

M0 (scaffolding), M1 (player movement, aiming, crouch, shooting, reload), M2 (map editor
with save/load and play-from-editor), M3 (enemy sight and hearing, debug overlays,
win/lose), M4 (the GOAP brain: goals, actions, planner, path finding, chatter), M5
(cover, peeking, blind fire, dodging) and M6 (squads: shared sightings, orders, suppress /
advance / search) are done.
See the build order in docs/PLAN.md.
