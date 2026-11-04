import { AnimateState } from './AnimateState.js';
import { GotoState } from './GotoState.js';

/**
 * The agent's finite state machine: just two states, Goto and Animate. It has
 * no logic about WHEN to switch; the planner decides that and actions call
 * goto() / animate(). Every tick it turns the current state into an Intent.
 */
export class AgentFSM {
  state = null;

  goto(params) {
    this.state = new GotoState(params);
  }

  animate(params) {
    this.state = new AnimateState(params);
  }

  stop() {
    this.state = null;
  }

  update(ctx, dt, intent) {
    this.state?.update(ctx, dt, intent);
  }

  /** 'goto' | 'animate' | 'idle' */
  get kind() {
    return this.state?.kind ?? 'idle';
  }

  /** The state's status: 'running', 'arrived', 'failed', 'done'; or 'idle' with no state. */
  get status() {
    return this.state?.status ?? 'idle';
  }
}
