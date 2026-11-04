/**
 * Debug overlay: every enemy's view cone in yellow, clipped by the walls that
 * block its sight, with a dashed arc at the shorter range at which a crouched
 * target can be seen. Shown when scene.debug.vision is on; scene.visionCones comes
 * from the simulation's DebugProbe, so it is exactly the area the AI checks.
 */
export class VisionOverlay {
  draw(ctx, { scene, theme, camera }) {
    if (!scene.debug.vision) return;
    const { colors } = theme;
    const pixel = 1 / camera.scale;

    for (const cone of scene.visionCones) {
      ctx.beginPath();
      ctx.moveTo(cone.x, cone.y);
      for (const point of cone.polygon) ctx.lineTo(point.x, point.y);
      ctx.closePath();
      ctx.fillStyle = colors.visionCone;
      ctx.fill();
      ctx.lineWidth = 1.5 * pixel;
      ctx.strokeStyle = colors.visionConeEdge;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cone.x, cone.y, cone.crouchedRange, cone.aimAngle - cone.halfFov, cone.aimAngle + cone.halfFov);
      ctx.setLineDash([6 * pixel, 5 * pixel]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
