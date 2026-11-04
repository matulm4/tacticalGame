import { TAU } from '../../../core/math.js';

/**
 * Draws the arena floor, grid, border and obstacles.
 * Layer contract: draw(ctx, frame) where frame = { scene, theme, camera, alpha }.
 * Low cover is light, but drawn as dark as high cover while the player is crouched.
 */
export class TerrainLayer {
  draw(ctx, { scene, theme, camera }) {
    const { width, height, obstacles } = scene.map;
    const { colors, sizes } = theme;
    const pixel = 1 / camera.scale; // one screen pixel in world units

    ctx.fillStyle = colors.arena;
    ctx.fillRect(0, 0, width, height);

    ctx.beginPath();
    for (let x = sizes.gridSpacing; x < width; x += sizes.gridSpacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = sizes.gridSpacing; y < height; y += sizes.gridSpacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.strokeStyle = colors.gridLine;
    ctx.lineWidth = sizes.gridLineWidth * pixel;
    ctx.stroke();

    for (const obstacle of obstacles) {
      ctx.fillStyle = obstacleColor(obstacle, scene, colors);
      if (obstacle.shape === 'rect') {
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
      } else {
        ctx.beginPath();
        ctx.arc(obstacle.cx, obstacle.cy, obstacle.r, 0, TAU);
        ctx.fill();
      }
    }

    ctx.strokeStyle = colors.arenaBorder;
    ctx.lineWidth = sizes.arenaBorderWidth * pixel;
    ctx.strokeRect(0, 0, width, height);
  }
}

/** Low cover looks like high cover once the player is crouched: it blocks them now. */
function obstacleColor(obstacle, scene, colors) {
  if (obstacle.height !== 'low') return colors.obstacleHigh;
  return scene.playerCrouched ? colors.obstacleHigh : colors.obstacleLow;
}
