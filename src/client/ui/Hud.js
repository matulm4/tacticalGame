import { activeWeaponOf } from '../../sim/entities/Agent.js';

function element(tag, className, text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/**
 * Player hit points (bottom left), enemies left (bottom middle) and ammo with
 * a reload bar (bottom right).
 */
export class Hud {
  #hp = element('div', 'hp');
  #enemies = element('div', 'enemies');
  #ammo = element('div', 'ammo');
  #count = element('div', 'count');
  #reload = element('div', 'reload');
  #hint = element('div', 'hint');
  #bar = element('div', 'bar');
  #fill = element('div', 'fill');
  #pips = [];
  #last = { hp: -1, maxHp: -1, ammo: -1, magSize: -1, hint: '', reloading: null, progress: -1, enemies: '' };

  constructor(container) {
    this.#bar.append(this.#fill);
    this.#bar.hidden = true;
    this.#reload.append(this.#hint, this.#bar);
    this.#ammo.append(this.#count, this.#reload);
    container.replaceChildren(this.#hp, this.#enemies, this.#ammo);
  }

  /**
   * Cheap to call every frame: the DOM is only touched when a value changed.
   * @param {object} player
   * @param {{ alive: number, total: number }} enemies  hidden when the map has none
   */
  update(player, enemies = { alive: 0, total: 0 }) {
    if (!player) return;
    const weapon = activeWeaponOf(player);
    const last = this.#last;

    if (player.maxHp !== last.maxHp) {
      this.#pips = Array.from({ length: player.maxHp }, () => element('div', 'pip'));
      this.#hp.replaceChildren(...this.#pips);
      last.maxHp = player.maxHp;
      last.hp = -1;
    }
    if (player.hp !== last.hp) {
      this.#pips.forEach((pip, index) => pip.classList.toggle('on', index < player.hp));
      last.hp = player.hp;
    }

    const enemyText = enemies.total > 0 ? `Enemies ${enemies.alive} / ${enemies.total}` : '';
    if (enemyText !== last.enemies) {
      this.#enemies.textContent = enemyText;
      this.#enemies.hidden = enemyText === '';
      last.enemies = enemyText;
    }

    if (!weapon) return;

    if (weapon.ammo !== last.ammo || weapon.def.magSize !== last.magSize) {
      this.#count.replaceChildren(
        document.createTextNode(String(weapon.ammo)),
        element('span', 'mag', ` / ${weapon.def.magSize}`),
      );
      last.ammo = weapon.ammo;
      last.magSize = weapon.def.magSize;
    }

    const reloading = weapon.reloadLeft > 0;
    if (reloading !== last.reloading) {
      this.#bar.hidden = !reloading;
      last.reloading = reloading;
      last.progress = -1;
    }
    if (reloading) {
      const progress = Math.round((1 - weapon.reloadLeft / weapon.def.reloadTime) * 200) / 200;
      if (progress !== last.progress) {
        this.#fill.style.transform = `scaleX(${progress})`;
        last.progress = progress;
      }
    }

    const hint = !reloading && weapon.ammo === 0 ? 'EMPTY - click or R' : '';
    if (hint !== last.hint) {
      this.#hint.textContent = hint;
      last.hint = hint;
    }
  }
}
