import { lerp } from '../../../core/math.js';
import { agentRadius } from '../../../sim/entities/Agent.js';

const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FADE = 0.3; // seconds a bubble takes to fade out at the end of its life

/**
 * Speech bubbles: the chatter lines enemies say (the EventPresenter turns
 * 'bark' events into 'bubble' effects). A bubble follows its speaker and fades.
 */
export class BubbleLayer {
  draw(ctx, { scene, theme, camera, alpha }) {
    const { colors, sizes } = theme;
    const pixel = 1 / camera.scale;
    const fontSize = sizes.speechFontSize * pixel;
    const padding = 6 * pixel;
    ctx.font = `${fontSize}px ${FONT}`;
    ctx.textBaseline = 'middle';

    for (const effect of scene.effects) {
      if (effect.kind !== 'bubble') continue;
      const age = scene.time - effect.born;
      if (age < 0 || age > effect.life) continue;

      const agent = scene.world.getAgent(effect.agentId);
      if (!agent?.alive) continue;

      const x = lerp(agent.prevX, agent.x, alpha);
      const y = lerp(agent.prevY, agent.y, alpha);
      const width = ctx.measureText(effect.text).width + padding * 2;
      const height = fontSize + padding * 2;
      const left = x - width / 2;
      const bottom = y - agentRadius(agent) - sizes.speechOffset * pixel;
      const top = bottom - height;

      ctx.globalAlpha = Math.min(1, (effect.life - age) / FADE);

      ctx.beginPath();
      ctx.roundRect(left, top, width, height, 5 * pixel);
      ctx.moveTo(x - 4 * pixel, bottom);
      ctx.lineTo(x, bottom + 6 * pixel);
      ctx.lineTo(x + 4 * pixel, bottom);
      ctx.fillStyle = colors.speechBubble;
      ctx.fill();
      ctx.lineWidth = pixel * 1.5;
      ctx.strokeStyle = colors.speechBubbleEdge;
      ctx.stroke();

      ctx.fillStyle = colors.speechText;
      ctx.fillText(effect.text, left + padding, top + height / 2);
    }
    ctx.globalAlpha = 1;
  }
}
