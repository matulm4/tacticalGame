# Level generation prompt

Paste everything between the two lines into any LLM, then add your level description
or attach a layout sketch after it. Save the reply as a `.json` file and open it in the
game's editor (**Open**) or drop it into `maps/` and list it in `maps/index.json`.

---

You design levels for a top-down tactical shooter. Turn the level description or sketch I give you into ONE valid JSON map file. Reply with the JSON only, in a single code block, with no comments (JSON has none) and no text before or after it. If something in my description is ambiguous, pick a sensible option instead of asking.

## File format

```
{
  "version": 1,
  "name": "short-level-name",
  "width": 1600,
  "height": 1000,
  "obstacles": [ ... ],
  "playerStart": { "x": 160, "y": 500, "angle": 0 },
  "spawns": [ ... ]
}
```

- `version` is always `1`. `width` and `height` are numbers between 200 and 8000 (default 1600 x 1000; use more for big levels). The map edge is already a solid wall, so an outer wall is optional.
- **Coordinates:** world units, origin at the top-left, x grows to the right, y grows DOWN. Use whole numbers, multiples of 20 where possible.
- **Angles** are in radians: `0` faces right (+x), `1.5708` faces down, `3.1416` faces left, `-1.5708` faces up.

### Obstacles

Each is either a rectangle or a circle, with a unique `id` (a short string such as `"wall-n-1"`):

```
{ "id": "wall-1", "shape": "rect",   "x": 100, "y": 60, "w": 400, "h": 40, "height": "high" }
{ "id": "pillar-1", "shape": "circle", "cx": 800, "cy": 500, "r": 40, "height": "low" }
```

- Rect: `x`, `y` is the TOP-LEFT corner, `w` and `h` are positive. Circle: `cx`, `cy` is the center, `r` positive. Rotated shapes do not exist: build diagonals from several small pieces only if really needed.
- `height` is `"high"` or `"low"`:
  - **high** (dark): walls, pillars, buildings. Blocks movement, sight and bullets. Use it for walls and rooms.
  - **low** (light grey): crates, sandbags, counters, low walls. Blocks movement. A standing character sees and shoots over it; a crouched one is hidden behind it and cannot shoot over it. Use it for cover.
- Walls are rectangles about 40 thick. A room is four wall rectangles with a gap for each door. Do not overlap walls needlessly; touching or overlapping is allowed.

### Player start

Exactly one `playerStart`, `{ "x", "y", "angle" }`, in open floor at least 40 units from any obstacle.

### Enemy spawns

```
{ "id": "g1", "type": "grunt", "team": "enemy", "x": 1340, "y": 330, "angle": 3.1416 }
```

- `id` unique. `team` is always `"enemy"`. `angle` is the way the enemy faces when posted.
- `type`:
  - `"grunt"`: walks, uses cover, investigates noises, searches. The main enemy.
  - `"sentry"`: never leaves its post (it can turn and shoot). Good for guarding a door, corridor end or window.
- Place each enemy on open floor, at least 40 units from any obstacle.

## Design rules that keep the level playable

1. **Space.** The player and enemies are about 36 units wide. Every passage, door and gap they must use should be at least **80** wide (never below 60). Doors of 80-100 are good.
2. **Enemy perception.** Enemies see 450 units in a 110 degree cone (225 if you crouch) and are blocked by high obstacles. Do not place enemies where they see the player start right away; give the player a few seconds of approach.
3. **Enemies.** If my description or sketch says where enemies are, put them exactly there (and of the type I say). Otherwise scatter them where it makes sense for the place: guards at doors and corridor ends, a few in rooms, some in open areas, singly or in small groups. A map 1600 x 1000 holds about 4-8 enemies; 3200 x 2000 holds about 10-16.
4. **Cover.** Enemies hide behind obstacles, so put some crates or low walls (about 40 thick, 100-200 long) and pillars in the areas where fights are likely. Leave room (at least 80) to walk around them.
5. **Layout.** Keep the player's path from start to the enemies readable. Prefer more than one route through the level where it suits the place (a second door, a side corridor).
6. **Validity.** Every spawn and the player start must sit on open floor inside the map, not inside an obstacle. Every enemy must be able to walk to the player (no sealed rooms) unless it is a sentry. IDs must be unique across obstacles, and across spawns.
7. The player wins by killing all enemies, so do not put enemies where the player cannot reach.

## If I give you a sketch or a description

- Scale it to the map: choose `width` and `height` that fit it, keep proportions, and convert every wall, room and crate to rectangles and circles in world units.
- Treat thick lines and filled blocks as `high` walls, hatched or lighter items as `low` cover, a "P" or green mark as the player start, red marks as enemies (an "S" or turret as a sentry, otherwise grunts), placed exactly where drawn, and arrows as facing directions.
- If I only describe the level in words, invent plausible sizes and positions that follow the rules above.

## Check before you answer

Before replying, verify silently: valid JSON (no trailing commas, no comments); `version` is 1; every obstacle has a unique `id`, a `shape` of `rect` or `circle`, the right numbers for that shape, and `height` of `high` or `low`; there is exactly one `playerStart`; every spawn has a unique `id`, `type` of `grunt` or `sentry`, `team` `"enemy"`, and numbers for `x`, `y`, `angle`; nothing is placed outside `0..width` and `0..height`; no spawn or the start lies inside an obstacle; all doors are at least 80 wide.

## Example (a tiny valid map)

```
{
  "version": 1,
  "name": "yard",
  "width": 1200,
  "height": 800,
  "obstacles": [
    { "id": "block", "shape": "rect", "x": 500, "y": 300, "w": 200, "h": 200, "height": "high" },
    { "id": "crate-n", "shape": "rect", "x": 280, "y": 200, "w": 40, "h": 140, "height": "low" },
    { "id": "crate-s", "shape": "rect", "x": 280, "y": 460, "w": 40, "h": 140, "height": "low" },
    { "id": "yard-low", "shape": "rect", "x": 820, "y": 340, "w": 40, "h": 120, "height": "low" },
    { "id": "pillar", "shape": "circle", "cx": 980, "cy": 560, "r": 40, "height": "high" }
  ],
  "playerStart": { "x": 100, "y": 400, "angle": 0 },
  "spawns": [
    { "id": "g1", "type": "grunt", "team": "enemy", "x": 1000, "y": 300, "angle": 3.1416 },
    { "id": "g2", "type": "grunt", "team": "enemy", "x": 1000, "y": 440, "angle": 3.1416 },
    { "id": "s1", "type": "sentry", "team": "enemy", "x": 1120, "y": 400, "angle": 3.1416 }
  ]
}
```

Now design this level:

[PASTE YOUR LEVEL DESCRIPTION HERE, OR ATTACH YOUR SKETCH]
