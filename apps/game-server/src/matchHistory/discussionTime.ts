import type { GameState } from "../schema/GameState.js";

/** Остаток основного таймера обсуждения (мс), согласованный с «заморозкой» в SpyfallRoom. */
export function getDiscussionRemainingMs(state: GameState, now: number): number {
  if (state.phase === "voting") {
    return Math.max(0, state.discussionTimerRemainingMs);
  }
  if (state.phase === "ended") {
    return Math.max(0, state.discussionTimerRemainingMs);
  }
  if (state.phase !== "discussion") {
    return Math.max(0, state.discussionTimerRemainingMs);
  }
  if (state.spyGuessVoteEndsAt > 0) {
    return Math.max(0, state.discussionTimerRemainingMs);
  }
  if (state.matchSplashType === "spy_kill" && state.matchSplashEndsAt > 0) {
    return Math.max(0, state.discussionTimerRemainingMs);
  }
  if (state.matchPaused) {
    return Math.max(0, state.matchEndsAt - now);
  }
  if (state.matchEndsAt <= 0) return 0;
  return Math.max(0, state.matchEndsAt - now);
}

export function discussionElapsedSec(scheduledMs: number, remainingMs: number): number {
  const elapsedMs = Math.max(0, scheduledMs - Math.max(0, remainingMs));
  return Math.floor(elapsedMs / 1000);
}
