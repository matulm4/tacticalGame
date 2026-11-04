const MUZZLE_LIFE = 0.06; // simulated seconds
const SPARK_LIFE = 0.2;
const SOUND_LIFE = 0.7;
const HIT_LIFE = 0.22;
const CORPSE_LIFE = 0.7;
const BUBBLE_LIFE = 2.2;

/**
 * Turns simulation events into visual-only state. The simulation never sees
 * this; effects exist purely so the player can feel shots, hits and noises.
 *
 * Effect kinds: muzzle, spark (a bullet hit something), sound (an expanding
 * ring, shown by the noise overlay), hit (a ring on a wounded agent), corpse
 * (a fading circle where an agent died) and bubble (a chatter line; an agent
 * has at most one at a time).
 */
export class EventPresenter {
  effects = [];

  handle(events) {
    for (const event of events) {
      const born = event.time;

      if (event.type === 'shotFired') {
        this.effects.push({ kind: 'muzzle', x: event.x, y: event.y, born, life: MUZZLE_LIFE });
      } else if (event.type === 'bulletHit') {
        this.effects.push({
          kind: 'spark',
          x: event.x,
          y: event.y,
          born,
          life: SPARK_LIFE,
          angles: Array.from({ length: 5 }, () => Math.random() * Math.PI * 2),
        });
      } else if (event.type === 'soundEmitted') {
        this.effects.push({ kind: 'sound', x: event.x, y: event.y, radius: event.radius, born, life: SOUND_LIFE });
      } else if (event.type === 'agentDamaged') {
        this.effects.push({ kind: 'hit', x: event.x, y: event.y, radius: event.radius, born, life: HIT_LIFE });
      } else if (event.type === 'bark') {
        this.effects = this.effects.filter((e) => !(e.kind === 'bubble' && e.agentId === event.agentId));
        this.effects.push({ kind: 'bubble', agentId: event.agentId, text: event.text, born, life: BUBBLE_LIFE });
      } else if (event.type === 'agentDied') {
        this.effects.push({
          kind: 'corpse',
          x: event.x,
          y: event.y,
          radius: event.radius,
          team: event.team,
          born,
          life: CORPSE_LIFE,
        });
      }
    }
  }

  /** Drop effects that have finished at simulation time `time`. */
  prune(time) {
    this.effects = this.effects.filter((effect) => time - effect.born <= effect.life);
  }

  clear() {
    this.effects = [];
  }
}
