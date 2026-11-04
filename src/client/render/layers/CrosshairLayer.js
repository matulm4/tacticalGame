/** Cross reticle at the aim point, with a light halo so it reads on dark obstacles. */
export class CrosshairLayer {
  draw(ctx, { scene, theme, camera }) {
    if (!scene.crosshair) return;
    const { colors, sizes } = theme;
    const pixel = 1 / camera.scale;
    const { x, y } = scene.crosshair;
    const gap = sizes.crosshairGap * pixel;
    const reach = (sizes.crosshairGap + sizes.crosshairArm) * pixel;

    const strokeCross = (color, width) => {
      ctx.beginPath();
      ctx.moveTo(x - reach, y);
      ctx.lineTo(x - gap, y);
      ctx.moveTo(x + gap, y);
      ctx.lineTo(x + reach, y);
      ctx.moveTo(x, y - reach);
      ctx.lineTo(x, y - gap);
      ctx.moveTo(x, y + gap);
      ctx.lineTo(x, y + reach);
      ctx.strokeStyle = color;
      ctx.lineWidth = width * pixel;
      ctx.lineCap = 'butt';
      ctx.stroke();
    };

    strokeCross(colors.crosshairHalo, sizes.crosshairHaloWidth);
    strokeCross(colors.crosshair, sizes.crosshairWidth);
  }
}
