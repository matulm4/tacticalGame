import { TAU } from '../../../core/math.js';
import { handlePoints, markerRadius } from '../../../editor/hitTest.js';
import { drawAgentGlyph } from '../glyphs.js';

/**
 * Editor chrome drawn over the terrain: snap grid, player start and enemy
 * spawn markers, the active tool's ghost, and the selection with its handles.
 * scene = { map, editor }.
 */
export class EditorLayer {
  draw(ctx, { scene, theme, camera }) {
    const { editor } = scene;
    const pixel = 1 / camera.scale;

    this.#snapGrid(ctx, editor, theme, camera, pixel);
    this.#markers(ctx, editor.map, theme, pixel);
    this.#ghost(ctx, editor.tool.preview(), theme, pixel);
    this.#selection(ctx, editor.selectedItem(), theme, pixel);
  }

  #snapGrid(ctx, editor, theme, camera, pixel) {
    const { size, enabled } = editor.snap;
    if (!enabled || size * camera.scale < theme.editor.minSnapGridPixels) return;
    const { width, height } = editor.map;

    ctx.beginPath();
    for (let x = size; x < width; x += size) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = size; y < height; y += size) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.strokeStyle = theme.editor.snapGrid;
    ctx.lineWidth = pixel;
    ctx.stroke();
  }

  #markers(ctx, map, theme, pixel) {
    const { teams } = theme.colors;
    if (map.playerStart) {
      drawAgentGlyph(ctx, theme, pixel, {
        ...map.playerStart,
        radius: markerRadius('playerStart', map.playerStart),
        fill: teams.player.fill,
      });
    }
    for (const spawn of map.spawns) {
      drawAgentGlyph(ctx, theme, pixel, {
        x: spawn.x,
        y: spawn.y,
        angle: spawn.angle,
        radius: markerRadius('spawn', spawn),
        fill: (teams[spawn.team] ?? teams.enemy).fill,
      });
    }
  }

  #ghost(ctx, preview, theme, pixel) {
    if (!preview) return;
    const { colors, editor } = theme;

    ctx.save();
    ctx.globalAlpha = editor.ghostAlpha;
    if (preview.kind === 'marker') {
      const palette = colors.teams[preview.team] ?? colors.teams.enemy;
      drawAgentGlyph(ctx, theme, pixel, { ...preview, fill: palette.fill });
    } else {
      ctx.fillStyle = preview.height === 'low' ? colors.obstacleLow : colors.obstacleHigh;
      this.#shapePath(ctx, preview);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = editor.selection;
      ctx.lineWidth = editor.selectionWidth * pixel;
      ctx.setLineDash([6 * pixel, 4 * pixel]);
      ctx.stroke();
    }
    ctx.restore();
  }

  #selection(ctx, item, theme, pixel) {
    if (!item) return;
    const { editor } = theme;
    const { kind, data } = item;

    ctx.strokeStyle = editor.selection;
    ctx.lineWidth = editor.selectionWidth * pixel;

    if (kind === 'obstacle') {
      this.#shapePath(ctx, data);
    } else {
      ctx.beginPath();
      ctx.arc(data.x, data.y, markerRadius(kind, data) + 4 * pixel, 0, TAU);
    }
    ctx.stroke();

    const handles = handlePoints(item);
    if (kind !== 'obstacle') {
      // a thin line from the marker to its turn handle
      const edge = markerRadius(kind, data);
      ctx.beginPath();
      ctx.moveTo(data.x + Math.cos(data.angle) * edge, data.y + Math.sin(data.angle) * edge);
      ctx.lineTo(handles[0].x, handles[0].y);
      ctx.stroke();
    }

    const half = (editor.handleSize * pixel) / 2;
    ctx.fillStyle = editor.handleFill;
    for (const handle of handles) {
      ctx.beginPath();
      if (kind === 'obstacle') ctx.rect(handle.x - half, handle.y - half, half * 2, half * 2);
      else ctx.arc(handle.x, handle.y, half, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }

  #shapePath(ctx, shape) {
    ctx.beginPath();
    if (shape.kind === 'circle' || shape.shape === 'circle') ctx.arc(shape.cx, shape.cy, shape.r, 0, TAU);
    else ctx.rect(shape.x, shape.y, shape.w, shape.h);
  }
}
