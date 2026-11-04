import { lerp } from '../../../core/math.js';

/** Bullets as short tracer lines, drawn at their interpolated position. */
export class BulletLayer {
  draw(ctx, { scene, theme, camera, alpha }) {
    const { colors, sizes } = theme;
    ctx.strokeStyle = colors.bullet;
    ctx.lineWidth = sizes.bulletWidth / camera.scale;
    ctx.lineCap = 'round';

    ctx.beginPath();
    for (const bullet of scene.world.bullets) {
      const x = lerp(bullet.prevX, bullet.x, alpha);
      const y = lerp(bullet.prevY, bullet.y, alpha);
      const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
      ctx.moveTo(x - (bullet.vx / speed) * sizes.bulletLength, y - (bullet.vy / speed) * sizes.bulletLength);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
