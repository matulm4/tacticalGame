import { HISTORY_LIMIT } from './limits.js';

/**
 * Undo/redo stack of commands. A command has do(map) and undo(map).
 * execute() runs a command and records it; record() only records one that has
 * already been applied (tools apply drags live, then record the result once).
 */
export class History {
  #undoStack = [];
  #redoStack = [];

  execute(command, map) {
    command.do(map);
    this.record(command);
  }

  record(command) {
    this.#undoStack.push(command);
    if (this.#undoStack.length > HISTORY_LIMIT) this.#undoStack.shift();
    this.#redoStack = [];
  }

  undo(map) {
    const command = this.#undoStack.pop();
    if (!command) return null;
    command.undo(map);
    this.#redoStack.push(command);
    return command;
  }

  redo(map) {
    const command = this.#redoStack.pop();
    if (!command) return null;
    command.do(map);
    this.#undoStack.push(command);
    return command;
  }

  get canUndo() {
    return this.#undoStack.length > 0;
  }

  get canRedo() {
    return this.#redoStack.length > 0;
  }

  clear() {
    this.#undoStack = [];
    this.#redoStack = [];
  }
}
