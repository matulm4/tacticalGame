import { FIRE_BUTTON } from './keybindings.js';

/**
 * Builds the simulation's PlayerInput from the raw input state and the camera
 * (which turns the mouse's screen position into the world-space aim point).
 * Called once per simulation tick.
 */
export class PlayerInputAdapter {
  #input;
  #camera;

  /**
   * @param {{ isDown, consumePressed, isMouseDown, mouse }} input  an InputManager
   * @param {{ screenToWorld }} camera
   */
  constructor(input, camera) {
    this.#input = input;
    this.#camera = camera;
  }

  read() {
    const input = this.#input;
    const aim = this.#camera.screenToWorld(input.mouse.x, input.mouse.y);
    return {
      moveX: Number(input.isDown('moveRight')) - Number(input.isDown('moveLeft')),
      moveY: Number(input.isDown('moveDown')) - Number(input.isDown('moveUp')),
      aimX: aim.x,
      aimY: aim.y,
      fire: input.isMouseDown(FIRE_BUTTON),
      reload: input.consumePressed('reload'),
      crouch: input.isDown('crouch'),
    };
  }
}
