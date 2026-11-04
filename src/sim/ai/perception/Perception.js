import { SENSOR_RATE } from '../../defs/tuning.js';
import { WorkingMemory } from '../memory/WorkingMemory.js';
import { bulletsNearby, isAimedAt } from './DangerSensor.js';
import { hearSounds } from './HearingSensor.js';
import { visibleHostiles } from './SightSensor.js';
import { selectTarget } from './TargetSelector.js';

const SIGHT_INTERVAL = 1 / SENSOR_RATE;

/**
 * An AI agent's senses. Call update() once per tick: hearing and passing
 * bullets are taken in every tick (a gunshot lasts one tick, a bullet is fast),
 * sight and "is a gun aimed at me" are checked SENSOR_RATE times a second.
 * Results are written to `memory`.
 */
export class Perception {
  memory = new WorkingMemory();
  #untilNextLook = 0;

  update(agent, world, dt) {
    hearSounds(this.memory, agent.heardSounds, world.time);
    if (bulletsNearby(world, agent)) this.memory.underFireAt = world.time;

    this.#untilNextLook -= dt;
    if (this.#untilNextLook > 0) return;
    this.#untilNextLook += SIGHT_INTERVAL;

    const target = selectTarget(agent, visibleHostiles(world, agent), this.memory.target?.id);
    if (target) this.memory.see(target, world.time);
    else this.memory.loseSight();

    // It only notices a gun aimed at it if it can see who is holding it.
    const shooter = target ? world.getAgent(target.id) : null;
    if (shooter && isAimedAt(world, agent, shooter)) this.memory.threatenedAt = world.time;
  }
}
