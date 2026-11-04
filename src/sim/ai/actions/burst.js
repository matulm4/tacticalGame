/**
 * Fires in bursts: a few shots, then a pause. Call update() once per tick; it
 * counts the shots from the ammo used and says whether the trigger may be pulled.
 */
export class BurstFire {
  #shotsLeft;
  #pause = 0;
  #lastAmmo = 0;
  #shots;
  #pauseTime;

  constructor({ shots = 3, pause = 0.7 } = {}) {
    this.#shots = shots;
    this.#pauseTime = pause;
    this.#shotsLeft = shots;
  }

  reset(weapon) {
    this.#shotsLeft = this.#shots;
    this.#pause = 0;
    this.#lastAmmo = weapon.ammo;
  }

  /** @returns {boolean} true when it is time to fire (not resting between bursts) */
  update(weapon, dt) {
    if (weapon.ammo < this.#lastAmmo) this.#shotsLeft -= this.#lastAmmo - weapon.ammo;
    this.#lastAmmo = weapon.ammo;

    if (this.#shotsLeft <= 0) {
      this.#shotsLeft = this.#shots;
      this.#pause = this.#pauseTime;
    }
    if (this.#pause > 0) this.#pause -= dt;
    return this.#pause <= 0;
  }

  /** Is it resting after a burst? (Cover actions duck back when a burst ends.) */
  get resting() {
    return this.#pause > 0;
  }
}
