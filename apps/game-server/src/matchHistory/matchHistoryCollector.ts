import type { GameState } from "../schema/GameState.js";
import { discussionElapsedSec, getDiscussionRemainingMs } from "./discussionTime.js";

export type MatchHistoryEvent = {
  type: string;
  t: number;
  at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
};

export class MatchHistoryCollector {
  private readonly events: MatchHistoryEvent[] = [];

  constructor(private readonly scheduledDiscussionMs: number) {}

  push(type: string, now: number, state: GameState, data?: Record<string, unknown>): void {
    const rem = getDiscussionRemainingMs(state, now);
    const t = discussionElapsedSec(this.scheduledDiscussionMs, rem);
    this.events.push({
      type,
      t,
      at: new Date(now).toISOString(),
      ...(data !== undefined ? { data } : {}),
    });
  }

  snapshot(): MatchHistoryEvent[] {
    return this.events.slice();
  }
}
