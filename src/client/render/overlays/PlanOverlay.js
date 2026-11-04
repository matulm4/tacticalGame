import { TAU } from '../../../core/math.js';

const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * Debug overlay: what each enemy wants and how it plans to get it. Above the
 * enemy: its goal and the plan, with the step it is on marked. On the ground:
 * the path it is walking, a line to the target it sees, and a ring where it
 * last saw one. Shown when scene.debug.plan is on; scene.aiInfo comes from the
 * simulation's DebugProbe.
 */
export class PlanOverlay {
  draw(ctx, { scene, theme, camera }) {
    if (!scene.debug.plan) return;
    const pixel = 1 / camera.scale;

    for (const info of scene.aiInfo) {
      this.#paths(ctx, info, theme, pixel);
      this.#label(ctx, info, theme, pixel);
    }
  }

  #paths(ctx, info, theme, pixel) {
    const { planAccent } = theme.colors;
    ctx.strokeStyle = planAccent;
    ctx.lineWidth = 2 * pixel;

    if (info.path) {
      ctx.beginPath();
      ctx.moveTo(info.x, info.y);
      for (const point of info.path) ctx.lineTo(point.x, point.y);
      ctx.setLineDash([8 * pixel, 5 * pixel]);
      ctx.stroke();
      ctx.setLineDash([]);

      const end = info.path.at(-1);
      ctx.beginPath();
      ctx.arc(end.x, end.y, 6 * pixel, 0, TAU);
      ctx.fillStyle = planAccent;
      ctx.fill();
    }

    if (info.target) {
      ctx.beginPath();
      ctx.moveTo(info.x, info.y);
      ctx.lineTo(info.target.x, info.target.y);
      ctx.stroke();
    } else if (info.lastKnown) {
      ctx.beginPath();
      ctx.arc(info.lastKnown.x, info.lastKnown.y, 10 * pixel, 0, TAU);
      ctx.setLineDash([3 * pixel, 4 * pixel]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  #label(ctx, info, theme, pixel) {
    const { colors, sizes } = theme;
    const lines = [(info.goal ?? 'no goal') + (info.order ? ` (${info.order})` : ''), planText(info)];
    const fontSize = sizes.planFontSize * pixel;
    const padding = 4 * pixel;
    const lineHeight = fontSize * 1.25;

    ctx.font = `${fontSize}px ${FONT}`;
    ctx.textBaseline = 'top';
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + padding * 2;
    const height = lines.length * lineHeight + padding * 2;
    const left = info.x - width / 2;
    const top = info.y + sizes.planLabelOffset; // below the agent: above it are the HP pips and speech bubble

    ctx.fillStyle = colors.planLabel;
    ctx.fillRect(left, top, width, height);
    ctx.strokeStyle = colors.planAccent;
    ctx.lineWidth = pixel;
    ctx.strokeRect(left, top, width, height);

    ctx.fillStyle = colors.planText;
    lines.forEach((line, index) => ctx.fillText(line, left + padding, top + padding + index * lineHeight));
  }
}

/** "Reload > [Attack]": the plan with the step being carried out in brackets. */
function planText(info) {
  if (info.plan.length === 0) return `(${info.state})`;
  return info.plan.map((name, index) => (index === info.step ? `[${name}]` : name)).join(' > ');
}
