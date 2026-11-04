import { activeWeaponOf } from '../entities/Agent.js';

/**
 * PlayerInput, as pushed in by the client every tick:
 *   moveX, moveY   -1..1 axes
 *   aimX, aimY     the aim point in world coordinates (the mouse)
 *   fire, crouch   held buttons
 *   reload         true on the tick the reload key was pressed
 */
export const NEUTRAL_PLAYER_INPUT = Object.freeze({
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  fire: false,
  reload: false,
  crouch: false,
});

/** Turns the latest PlayerInput into an Intent for the player's agent. */
export class PlayerController {
  #input = NEUTRAL_PLAYER_INPUT;

  setInput(input) {
    this.#input = input;
  }

  getIntent(agent) {
    const input = this.#input;
    const weapon = activeWeaponOf(agent);

    const dx = input.aimX - agent.x;
    const dy = input.aimY - agent.y;
    const aimAngle = dx * dx + dy * dy < 1 ? agent.aimAngle : Math.atan2(dy, dx);

    return {
      moveX: input.moveX,
      moveY: input.moveY,
      aimAngle,
      fire: input.fire,
      blind: null,
      // Convenience for the player only: pulling the trigger on an empty magazine reloads.
      reload: input.reload || (input.fire && weapon !== null && weapon.ammo === 0),
      crouch: input.crouch,
    };
  }
}
