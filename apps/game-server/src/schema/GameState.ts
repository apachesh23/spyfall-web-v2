/**
 * Дублирует `packages/shared/src/colyseus/gameState.ts` — tsx + `@spyfall/shared` ломают класс
 * (не constructor / нет именованного экспорта при `tsx watch src/index.ts`). Next.js берёт shared.
 */
import { defineTypes, MapSchema, Schema } from "@colyseus/schema";

export class MatchPlayerState extends Schema {
  declare id: string;
  declare nickname: string;
  declare avatarId: number;
  declare isHost: boolean;
  declare isSpy: boolean;
  declare roleAtLocation: string;
  declare spyCardUrl: string;
  declare eliminated: boolean;
}
defineTypes(MatchPlayerState, {
  id: "string",
  nickname: "string",
  avatarId: "number",
  isHost: "boolean",
  isSpy: "boolean",
  roleAtLocation: "string",
  spyCardUrl: "string",
  eliminated: "boolean",
});

export class GameState extends Schema {
  declare phase: string;
  declare matchEndsAt: number;
  declare matchPaused: boolean;
  declare matchSessionId: string;
  declare locationName: string;
  declare locationImageKey: string;
  declare themeText: string;
  declare modeTheme: boolean;
  declare modeRole: boolean;
  declare players: MapSchema<MatchPlayerState>;

  declare gameStartedAt: number;
  declare votingDurationSec: number;
  declare firstEarlyVoteAfterAt: number;
  declare earlyVoteCooldownUntil: number;
  declare earlyVotesUsed: number;
  declare voteIsFinal: boolean;
  declare voteStage: string;
  declare voteEndsAt: number;
  declare voteTransitionEndsAt: number;
  declare revoteA: string;
  declare revoteB: string;
  declare stubEliminatedId: string;
  declare earlyVoteAck: MapSchema<string>;
  declare voteBallots: MapSchema<string>;
  declare discussionTimerRemainingMs: number;
  declare gameEndReason: string;
  declare matchSplashType: string;
  declare matchSplashAt: number;
  declare matchSplashEndsAt: number;
  declare matchSplashEliminatedId: string;
  declare matchSplashVotePercent: number;
  declare matchSplashEliminationGameOver: boolean;

  constructor() {
    super();
    this.players = new MapSchema<MatchPlayerState>();
    this.matchPaused = false;
    this.gameStartedAt = 0;
    this.votingDurationSec = 60;
    this.firstEarlyVoteAfterAt = 0;
    this.earlyVoteCooldownUntil = 0;
    this.earlyVotesUsed = 0;
    this.voteIsFinal = false;
    this.voteStage = "idle";
    this.voteEndsAt = 0;
    this.voteTransitionEndsAt = 0;
    this.revoteA = "";
    this.revoteB = "";
    this.stubEliminatedId = "";
    this.earlyVoteAck = new MapSchema<string>();
    this.voteBallots = new MapSchema<string>();
    this.discussionTimerRemainingMs = 0;
    this.gameEndReason = "";
    this.matchSplashType = "";
    this.matchSplashAt = 0;
    this.matchSplashEndsAt = 0;
    this.matchSplashEliminatedId = "";
    this.matchSplashVotePercent = 0;
    this.matchSplashEliminationGameOver = false;
  }
}
defineTypes(GameState, {
  phase: "string",
  matchEndsAt: "number",
  matchPaused: "boolean",
  matchSessionId: "string",
  locationName: "string",
  locationImageKey: "string",
  themeText: "string",
  modeTheme: "boolean",
  modeRole: "boolean",
  players: { map: MatchPlayerState },
  gameStartedAt: "number",
  votingDurationSec: "number",
  firstEarlyVoteAfterAt: "number",
  earlyVoteCooldownUntil: "number",
  earlyVotesUsed: "number",
  voteIsFinal: "boolean",
  voteStage: "string",
  voteEndsAt: "number",
  voteTransitionEndsAt: "number",
  revoteA: "string",
  revoteB: "string",
  stubEliminatedId: "string",
  earlyVoteAck: { map: "string" },
  voteBallots: { map: "string" },
  discussionTimerRemainingMs: "number",
  gameEndReason: "string",
  matchSplashType: "string",
  matchSplashAt: "number",
  matchSplashEndsAt: "number",
  matchSplashEliminatedId: "string",
  matchSplashVotePercent: "number",
  matchSplashEliminationGameOver: "boolean",
});
