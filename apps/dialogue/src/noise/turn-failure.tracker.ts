export type TurnDropReason = 'no-speech' | 'other-speaker';

export type TurnFailureTrackerOptions = {
  /** dropped turns within the window that make a room "noisy" */
  threshold: number;
  windowMs: number;
  /** minimum time between two suggestions for one session */
  cooldownMs: number;
};

type SessionState = {
  drops: number[];
  lastSuggestion?: number;
  /** a suggestion was made and no turn has been answered since */
  suggested?: boolean;
};

/**
 * Counts the dropped voice turns of each session. A room where people talk nearby
 * produces a run of drops (nothing transcribed, another speaker); `drop` answers
 * true once that run reaches the threshold, so the avatar can suggest typing
 * instead of staying silent. An answered turn resets it.
 *
 * The suggestion is made once per run: a room that stays noisy (often nobody is
 * there, just background chatter) does not hear it again until a turn is answered,
 * and then not before the cooldown.
 */
export class TurnFailureTracker {
  private readonly sessions = new Map<string, SessionState>();

  constructor(private readonly options: TurnFailureTrackerOptions) {}

  /** records a dropped turn; true when a suggestion is due now */
  drop(sessionId: string, now = Date.now()): boolean {
    const state = this.sessions.get(sessionId) || { drops: [] };
    if (state.suggested) return false;
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
    state.suggested = true;
    state.drops = [];
    return true;
  }

  /** an answered turn: the run of drops is over and the suggestion re-arms (the cooldown stays) */
  answered(sessionId: string) {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    state.drops = [];
    state.suggested = false;
  }

  clear(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  size() {
    return this.sessions.size;
  }
}
