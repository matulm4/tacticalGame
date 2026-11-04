import { TAU } from '../../../core/math.js';

/**
 * Short-lived visual effects created by the EventPresenter (muzzle flash, hit
 * sparks, wound rings, fading corpses). They are timed in simulation time, so
 * pausing freezes them. (Sound rings belong to the noise overlay.)
 */
export class EffectsLayer {
  draw(ctx, { scene, theme, camera }) {
    const { colors } = theme;
    const pixel = 1 / camera.scale;

    for (const effect of scene.effects) {
      const age = scene.time - effect.born;
      if (age < 0 || age > effect.life) continue;
      const t = age / effect.life;

      ctx.globalAlpha = 1 - t;
      if (effect.kind === 'muzzle') {
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 7 - 4 * t, 0, TAU);
        ctx.fillStyle = colors.muzzleFlash;
        ctx.fill();
      } else if (effect.kind === 'spark') {
        ctx.beginPath();
        for (const angle of effect.angles) {
          const near = 2 + 6 * t;
          const far = 5 + 12 * t;
          ctx.moveTo(effect.x + Math.cos(angle) * near, effect.y + Math.sin(angle) * near);
          ctx.lineTo(effect.x + Math.cos(angle) * far, effect.y + Math.sin(angle) * far);
        }
        ctx.strokeStyle = colors.spark;
        ctx.lineWidth = 2 * pixel;
        ctx.lineCap = 'round';
        ctx.stroke();
      } else if (effect.kind === 'hit') {
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (1 + 0.8 * t), 0, TAU);
        ctx.strokeStyle = colors.hitRing;
        ctx.lineWidth = 3 * pixel;
        ctx.stroke();
      } else if (effect.kind === 'corpse') {
        ctx.globalAlpha = 0.55 * (1 - t);
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, TAU);
        ctx.fillStyle = (colors.teams[effect.team] ?? colors.teams.enemy).crouched;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
