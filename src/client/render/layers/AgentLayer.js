import { TAU, lerp } from '../../../core/math.js';
import { agentRadius } from '../../../sim/entities/Agent.js';
import { drawAgentGlyph } from '../glyphs.js';

/**
 * Draws every living agent. Crouched agents are smaller (their real hit radius)
 * and darker. Enemies with more than one hit point get a row of pips above them
 * (the player's hit points are in the HUD).
 */
export class AgentLayer {
  draw(ctx, { scene, theme, camera, alpha }) {
    const pixel = 1 / camera.scale;
    const playerId = scene.world.playerId;

    for (const agent of scene.world.agents) {
      if (!agent.alive) continue;

      const x = lerp(agent.prevX, agent.x, alpha);
      const y = lerp(agent.prevY, agent.y, alpha);
      const radius = agentRadius(agent);
      const palette = theme.colors.teams[agent.team] ?? theme.colors.teams.enemy;

      drawAgentGlyph(ctx, theme, pixel, {
        x,
        y,
        radius,
        angle: agent.aimAngle,
        fill: agent.crouched ? palette.crouched : palette.fill,
      });

      if (agent.id !== playerId && agent.maxHp > 1) {
        this.#hpPips(ctx, theme, x, y - radius - theme.sizes.hpPipOffset, agent);
      }
    }
  }

  #hpPips(ctx, theme, centerX, y, agent) {
    const { colors, sizes } = theme;
    const spacing = sizes.hpPipRadius * 2.8;
    const left = centerX - ((agent.maxHp - 1) * spacing) / 2;

    for (let i = 0; i < agent.maxHp; i++) {
      ctx.beginPath();
      ctx.arc(left + i * spacing, y, sizes.hpPipRadius, 0, TAU);
      ctx.fillStyle = i < agent.hp ? colors.hpPip : colors.hpPipEmpty;
      ctx.fill();
    }
  }
}
