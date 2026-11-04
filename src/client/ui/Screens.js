const TEXT = {
  win: { title: 'Area cleared', detail: 'Every enemy is down.' },
  lose: { title: 'You died', detail: 'Three hits is all it takes.' },
};

function element(tag, className, text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** The end-of-match overlay: what happened, and buttons to try again or go back to the editor. */
export class Screens {
  #root;
  #title = element('h2', 'title');
  #detail = element('p', 'detail');

  /**
   * @param {HTMLElement} container
   * @param {{ onRestart: () => void, onEditor: () => void }} handlers
   */
  constructor(container, { onRestart, onEditor }) {
    this.#root = container;

    const restart = element('button', 'primary', 'Restart (Enter)');
    restart.type = 'button';
    restart.addEventListener('click', onRestart);
    const editor = element('button', '', 'Editor (Tab)');
    editor.type = 'button';
    editor.addEventListener('click', onEditor);

    const card = element('div', 'card');
    card.append(this.#title, this.#detail, element('div', 'actions'));
    card.lastChild.append(restart, editor);
    container.replaceChildren(card);
    this.hide();
  }

  /** @param {'win' | 'lose'} outcome */
  show(outcome) {
    const { title, detail } = TEXT[outcome];
    this.#title.textContent = title;
    this.#detail.textContent = detail;
    this.#root.dataset.outcome = outcome;
    this.#root.hidden = false;
  }

  hide() {
    this.#root.hidden = true;
  }
}
