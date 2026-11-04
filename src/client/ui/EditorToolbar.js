import { GRID_SIZES } from '../../editor/limits.js';

const TOOLS = [
  ['select', 'Select', 'Select and edit (V)'],
  ['rect', 'Rectangle', 'Draw a rectangle (R)'],
  ['circle', 'Circle', 'Draw a circle (C)'],
  ['playerStart', 'Player', 'Place the player start (P). Drag before releasing to set the direction'],
  ['enemySpawn', 'Enemy', 'Place an enemy spawn (E). Drag before releasing to set the direction'],
];

const HEIGHTS = [
  ['high', 'High', 'High cover: blocks sight, bullets and movement (H toggles)'],
  ['low', 'Low', 'Low cover: you can see and shoot over it standing, but not crouched (H toggles)'],
];

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function button(label, title, onClick) {
  const node = el('button', { type: 'button', textContent: label, title });
  node.addEventListener('click', onClick);
  return node;
}

function group(...children) {
  return el('div', { className: 'group' }, children);
}

/**
 * The editor's DOM toolbar: tools, cover height, snapping, undo/redo, file
 * actions, Play and a status line. It only calls EditorState and the callbacks
 * it was given, and redraws its button states whenever the editor changes.
 */
export class EditorToolbar {
  #editor;
  #toolButtons = new Map();
  #heightButtons = new Map();
  #snapButton;
  #gridSelect;
  #undoButton;
  #redoButton;
  #deleteButton;
  #spawnTypeSelect;
  #nameInput;
  #sampleSelect;
  #status;
  #fileInput;

  /**
   * @param {HTMLElement} container
   * @param {object} options
   * @param {import('../../editor/EditorState.js').EditorState} options.editor
   * @param {() => void} options.onPlay
   * @param {() => void} options.onSave
   * @param {() => void} options.onNew
   * @param {(file: File) => void} options.onOpenFile
   * @param {(fileName: string) => void} options.onSample
   */
  constructor(container, { editor, onPlay, onSave, onNew, onOpenFile, onSample }) {
    this.#editor = editor;

    const toolGroup = group(
      ...TOOLS.map(([id, label, title]) => {
        const node = button(label, title, () => editor.setTool(id));
        this.#toolButtons.set(id, node);
        return node;
      }),
    );

    this.#spawnTypeSelect = el('select', { title: 'Enemy type to place' });
    this.#spawnTypeSelect.addEventListener('change', () => editor.setSpawnType(this.#spawnTypeSelect.value));
    for (const type of editor.spawnTypes) this.#spawnTypeSelect.append(el('option', { value: type, textContent: type }));

    const heightGroup = group(
      el('span', { className: 'label', textContent: 'Cover' }),
      ...HEIGHTS.map(([id, label, title]) => {
        const node = button(label, title, () => editor.setCoverHeight(id));
        this.#heightButtons.set(id, node);
        return node;
      }),
    );

    this.#snapButton = button('Snap', 'Snap to the grid (G). Hold Alt while dragging to turn it off', () => editor.toggleSnap());
    this.#gridSelect = el('select', { title: 'Grid size' });
    for (const size of GRID_SIZES) this.#gridSelect.append(el('option', { value: String(size), textContent: String(size) }));
    this.#gridSelect.addEventListener('change', () => editor.setGridSize(Number(this.#gridSelect.value)));
    const snapGroup = group(this.#snapButton, this.#gridSelect);

    this.#undoButton = button('Undo', 'Undo (Ctrl/Cmd+Z)', () => editor.undo());
    this.#redoButton = button('Redo', 'Redo (Ctrl/Cmd+Shift+Z)', () => editor.redo());
    this.#deleteButton = button('Delete', 'Delete the selection (Delete)', () => editor.deleteSelection());
    const editGroup = group(
      this.#undoButton,
      this.#redoButton,
      this.#deleteButton,
      button('Clear', 'Remove everything (can be undone)', () => editor.clearMap()),
    );

    this.#nameInput = el('input', { type: 'text', className: 'name', title: 'Map name', spellcheck: false });
    this.#nameInput.addEventListener('input', () => editor.setName(this.#nameInput.value));
    this.#sampleSelect = el('select', { title: 'Open a sample map' });
    this.#sampleSelect.addEventListener('change', () => {
      if (this.#sampleSelect.value) onSample(this.#sampleSelect.value);
      this.#sampleSelect.value = '';
    });
    this.#fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
    this.#fileInput.addEventListener('change', () => {
      const [file] = this.#fileInput.files;
      this.#fileInput.value = '';
      if (file) onOpenFile(file);
    });
    const fileGroup = group(
      this.#nameInput,
      button('New', 'Start an empty map', onNew),
      button('Open', 'Open a map file', () => this.#fileInput.click()),
      button('Save', 'Download the map as a .json file (Ctrl/Cmd+S)', onSave),
      this.#sampleSelect,
      this.#fileInput,
    );

    const play = button('Play (Tab)', 'Play this map (Tab)', onPlay);
    play.classList.add('play');

    this.#status = el('div', { className: 'status' });
    container.replaceChildren(
      el('div', { className: 'row' }, [toolGroup, this.#spawnTypeSelect, heightGroup, snapGroup, editGroup, fileGroup, group(play)]),
      this.#status,
    );

    editor.subscribe(() => this.render());
    new ResizeObserver(() => this.#publishHeight(container)).observe(container);
    this.render();
  }

  /** Fill the "open a sample" menu. */
  setSamples(samples) {
    this.#sampleSelect.replaceChildren(
      el('option', { value: '', textContent: 'Samples...' }),
      ...samples.map(({ name, file }) => el('option', { value: file, textContent: name })),
    );
  }

  render() {
    const editor = this.#editor;

    for (const [id, node] of this.#toolButtons) node.setAttribute('aria-pressed', String(editor.toolId === id));
    for (const [id, node] of this.#heightButtons) node.setAttribute('aria-pressed', String(editor.activeCoverHeight() === id));
    this.#snapButton.setAttribute('aria-pressed', String(editor.snap.enabled));
    this.#gridSelect.value = String(editor.snap.size);
    this.#gridSelect.disabled = !editor.snap.enabled;
    this.#undoButton.disabled = !editor.canUndo;
    this.#redoButton.disabled = !editor.canRedo;
    this.#deleteButton.disabled = !editor.selection;

    this.#spawnTypeSelect.value = editor.spawnType;
    this.#spawnTypeSelect.hidden = editor.toolId !== 'enemySpawn' || editor.spawnTypes.length < 2;

    // Do not fight the user for the text field while they are typing in it.
    if (document.activeElement !== this.#nameInput) this.#nameInput.value = editor.map.name;

    this.#renderStatus();
  }

  #renderStatus() {
    const { map, dirty, message } = this.#editor;
    const summary = `${map.obstacles.length} obstacles, ${map.spawns.length} enemy spawns${dirty ? ', unsaved changes' : ''}`;

    const issue = message
      ? { text: message.text, severity: message.severity }
      : this.#editor.lint().map(({ severity, message: text }) => ({ text, severity }))[0];

    this.#status.replaceChildren(
      el('span', { textContent: summary }),
      ...(issue ? [el('span', { className: `issue ${issue.severity}`, textContent: issue.text })] : []),
    );
  }

  /** The canvas sits below the toolbar in editor mode; tell the CSS how tall it is. */
  #publishHeight(container) {
    document.documentElement.style.setProperty('--toolbar-height', `${container.offsetHeight}px`);
  }
}
