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
  declare deathReason: string;
  /** Попытки угадать локацию этим шпионом (только при ≥2 шпионах: 0 или 1; в соло — 0, лимит в state.spyGuessAttemptsUsed). */
  declare spyGuessUses: number;
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
  deathReason: "string",
  spyGuessUses: "number",
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
  declare modeHiddenThreat: boolean;
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

  /** Сколько раз шпион уже «сжёг» попытку угадать (0–2). */
  declare spyGuessAttemptsUsed: number;
  /** Epoch ms: до этого момента кнопка заблокирована перезарядкой (после 1-й попытки). */
  declare spyGuessCooldownUntil: number;
  /** >0 — идёт голосование мирных по формулировке шпиона. */
  declare spyGuessVoteEndsAt: number;
  declare spyGuessVoteStartsAt: number;
  declare spyGuessIsAutoWin: boolean;
  declare spyGuessText: string;
  declare spyGuessSpyId: string;
  declare spyGuessBallots: MapSchema<string>;

  declare spyKillAttemptsUsed: number;
  declare spyKillCooldownUntil: number;
  declare spyDiscussActionsUnlockAt: number;

  /** Сколько шпионов в ростере при старте (1–3) — лимиты действий и клиент. */
  declare initialSpyCount: number;
  /** При финальном голосовании: живых шпионов на старте текущего раунда (плашка «Осталось N…»). */
  declare voteFinalSpiesRemaining: number;

  constructor() {
    super();
    this.players = new MapSchema<MatchPlayerState>();
    this.matchPaused = false;
    this.modeHiddenThreat = false;
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
    this.spyGuessAttemptsUsed = 0;
    this.spyGuessCooldownUntil = 0;
    this.spyGuessVoteEndsAt = 0;
    this.spyGuessVoteStartsAt = 0;
    this.spyGuessIsAutoWin = false;
    this.spyGuessText = "";
    this.spyGuessSpyId = "";
    this.spyGuessBallots = new MapSchema<string>();
    this.spyKillAttemptsUsed = 0;
    this.spyKillCooldownUntil = 0;
    this.spyDiscussActionsUnlockAt = 0;
    this.initialSpyCount = 1;
    this.voteFinalSpiesRemaining = 0;
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
  modeHiddenThreat: "boolean",
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
  spyGuessAttemptsUsed: "number",
  spyGuessCooldownUntil: "number",
  spyGuessVoteEndsAt: "number",
  spyGuessVoteStartsAt: "number",
  spyGuessIsAutoWin: "boolean",
  spyGuessText: "string",
  spyGuessSpyId: "string",
  spyGuessBallots: { map: "string" },
  spyKillAttemptsUsed: "number",
  spyKillCooldownUntil: "number",
  spyDiscussActionsUnlockAt: "number",
  initialSpyCount: "number",
  voteFinalSpiesRemaining: "number",
});
