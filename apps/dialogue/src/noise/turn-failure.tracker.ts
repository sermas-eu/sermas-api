export type TurnDropReason = 'no-speech' | 'other-speaker';

export type TurnFailureTrackerOptions = {
  /** dropped turns within the window that make a room "noisy" */
  threshold: number;
  windowMs: number;
  /** minimum time between two suggestions for one session */
  cooldownMs: number;
};

type SessionState = { drops: number[]; lastSuggestion?: number };

/**
 * Counts the dropped voice turns of each session. A room where people talk nearby
 * produces a run of drops (nothing transcribed, another speaker, chatter the LLM
 * filter skips); `drop` answers true once that run reaches the threshold, so the
 * avatar can suggest typing instead of staying silent. An answered turn resets it.
 */
export class TurnFailureTracker {
  private readonly sessions = new Map<string, SessionState>();

  constructor(private readonly options: TurnFailureTrackerOptions) {}

  /** records a dropped turn; true when a suggestion is due now */
  drop(sessionId: string, now = Date.now()): boolean {
    const state = this.sessions.get(sessionId) || { drops: [] };
    state.drops = state.drops.filter((t) => now - t < this.options.windowMs);
    state.drops.push(now);
    this.sessions.set(sessionId, state);

    if (state.drops.length < this.options.threshold) return false;
    if (
      state.lastSuggestion !== undefined &&
      now - state.lastSuggestion < this.options.cooldownMs
    ) {
      return false;
    }
    state.lastSuggestion = now;
    state.drops = [];
    return true;
  }

  /** an answered turn: the run of drops is over (the cooldown stays) */
  answered(sessionId: string) {
    const state = this.sessions.get(sessionId);
    if (state) state.drops = [];
  }

  clear(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  size() {
    return this.sessions.size;
  }
}
