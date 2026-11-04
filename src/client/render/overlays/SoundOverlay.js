import { TAU } from '../../../core/math.js';

/**
 * Debug overlay: every sound as a soft blue ring that expands to the radius
 * the sound carries (footsteps, gunshots). Shown when scene.debug.noise is on.
 * The ring shows the nominal radius; walls muffle it for listeners behind them.
 */
export class SoundOverlay {
  draw(ctx, { scene, theme, camera }) {
    if (!scene.debug.noise) return;
    const { colors } = theme;
    const pixel = 1 / camera.scale;

    for (const effect of scene.effects) {
      if (effect.kind !== 'sound') continue;
      const age = scene.time - effect.born;
      if (age < 0 || age > effect.life) continue;

      const t = age / effect.life;
      const radius = effect.radius * (1 - (1 - t) * (1 - t)); // starts fast, eases out

      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius, 0, TAU);
      ctx.fillStyle = colors.soundWave;
      ctx.fill();
      ctx.lineWidth = 2 * pixel;
      ctx.strokeStyle = colors.soundWaveEdge;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
