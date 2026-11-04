import { TAU } from '../../../core/math.js';

/**
 * Debug overlay: every cover position as a dot, bright where it would hide an
 * agent from the player right now and faint where it would not; plus a ring
 * round the cover each enemy has taken. Shown when scene.debug.cover is on;
 * the data comes from the simulation's DebugProbe.
 */
export class CoverOverlay {
  draw(ctx, { scene, theme, camera }) {
    if (!scene.debug.cover) return;
    const { colors } = theme;
    const pixel = 1 / camera.scale;

    for (const node of scene.coverNodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, (node.hidesFromPlayer ? 5 : 3) * pixel, 0, TAU);
      ctx.fillStyle = node.hidesFromPlayer ? colors.coverHidden : colors.coverExposed;
      ctx.fill();
    }

    ctx.strokeStyle = colors.coverTaken;
    ctx.lineWidth = 2.5 * pixel;
    for (const info of scene.aiInfo) {
      if (!info.cover) continue;
      ctx.beginPath();
      ctx.arc(info.cover.x, info.cover.y, 11 * pixel, 0, TAU);
      ctx.stroke();
    }
  }
}
