import { TAU } from '../../../core/math.js';

const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * Debug overlay: the squads. Each squad has its own color: spokes join its
 * members to a hub that says which squad it is and what behavior it is running
 * (a ring for a squad that is idle), each member says what it has been ordered
 * to do, and a cross marks where the squad believes the enemy is (solid if
 * somebody sees it now, dashed if it is only the last known spot). Shown when
 * scene.debug.squads is on; scene.squads comes from the simulation's DebugProbe.
 */
export class SquadOverlay {
  draw(ctx, { scene, theme, camera }) {
    if (!scene.debug.squads) return;
    const pixel = 1 / camera.scale;
    const { squads: palette, squadText, squadLabel } = theme.colors;

    scene.squads.forEach((squad) => {
      const color = palette[squad.squadId % palette.length];
      const hub = centroid(squad.members);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2 * pixel;

      for (const member of squad.members) {
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(member.x, member.y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(hub.x, hub.y, 7 * pixel, 0, TAU);
      if (squad.behavior) ctx.fill();
      else ctx.stroke();

      if (squad.sighting) this.#sighting(ctx, squad.sighting, pixel);

      const fontSize = theme.sizes.planFontSize * pixel;
      ctx.font = `${fontSize}px ${FONT}`;
      ctx.textBaseline = 'middle';
      this.#text(ctx, `squad ${squad.squadId}: ${squad.behavior ?? 'idle'}`, hub.x + 12 * pixel, hub.y, { color, squadText, squadLabel, pixel, fontSize });
      for (const member of squad.members) {
        if (member.order) {
          this.#text(ctx, member.order, member.x + 24 * pixel, member.y - 14 * pixel, { color, squadText, squadLabel, pixel, fontSize });
        }
      }
    });
  }

  #sighting(ctx, sighting, pixel) {
    const arm = 9 * pixel;
    ctx.setLineDash(sighting.visible ? [] : [4 * pixel, 4 * pixel]);
    ctx.beginPath();
    ctx.moveTo(sighting.x - arm, sighting.y - arm);
    ctx.lineTo(sighting.x + arm, sighting.y + arm);
    ctx.moveTo(sighting.x - arm, sighting.y + arm);
    ctx.lineTo(sighting.x + arm, sighting.y - arm);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  #text(ctx, text, x, y, { color, squadText, squadLabel, pixel, fontSize }) {
    const padding = 3 * pixel;
    const width = ctx.measureText(text).width + padding * 2;
    ctx.fillStyle = squadLabel;
    ctx.fillRect(x - padding, y - fontSize / 2 - padding, width, fontSize + padding * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = pixel;
    ctx.strokeRect(x - padding, y - fontSize / 2 - padding, width, fontSize + padding * 2);
    ctx.fillStyle = squadText;
    ctx.fillText(text, x, y);
    ctx.fillStyle = color;
  }
}

function centroid(members) {
  const sum = members.reduce((acc, m) => ({ x: acc.x + m.x, y: acc.y + m.y }), { x: 0, y: 0 });
  return { x: sum.x / members.length, y: sum.y / members.length };
}
