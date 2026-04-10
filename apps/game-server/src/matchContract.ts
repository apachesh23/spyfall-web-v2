/**
 * Дублирует контракт из `packages/shared` для game-server.
 * Node/tsx + ESM плохо подхватывают именованные экспорты из workspace `*.ts` (`@spyfall/shared`),
 * поэтому здесь копия — держи в синхроне с `packages/shared/src/index.ts`.
 */

export const COLYSEUS_ROOM_NAME = "spyfall" as const;

export type MatchJoinOptions = {
  matchSessionId: string;
  playerId: string;
  nickname: string;
  discussionDurationMs?: number;
  votingDurationMs?: number;
};

export const WS_CLIENT_MESSAGE = {
  ping: "ping",
  matchPause: "matchPause",
  matchResume: "matchResume",
  earlyVoteToggle: "earlyVoteToggle",
  voteCast: "voteCast",
  voteSkip: "voteSkip",
} as const;

export const WS_SERVER_MESSAGE = {
  matchAssignment: "matchAssignment",
} as const;
