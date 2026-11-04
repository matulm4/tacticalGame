import { TAU } from '../../core/math.js';

/**
 * An agent (or spawn marker) as a circle with a short line sticking out of its
 * edge in the aim direction (never inside the circle).
 * @param {number} pixel  one screen pixel in world units
 */
export function drawAgentGlyph(ctx, theme, pixel, { x, y, radius, angle, fill }) {
  const { colors, sizes } = theme;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  // Aim line first: the circle's outline then covers where it joins.
  ctx.beginPath();
  ctx.moveTo(x + dirX * radius, y + dirY * radius);
  ctx.lineTo(x + dirX * (radius + sizes.aimLineLength), y + dirY * (radius + sizes.aimLineLength));
  ctx.lineWidth = sizes.aimLineWidth;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = colors.aimLine;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = sizes.agentOutlineWidth * pixel;
  ctx.strokeStyle = colors.agentOutline;
  ctx.stroke();
}
