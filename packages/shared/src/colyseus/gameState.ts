/**
 * Клиент (Next) и матчмейкинг. Сервер: дубль в `apps/game-server/src/schema/GameState.ts` — tsx не тянет workspace.
 */
import { defineTypes, MapSchema, Schema } from "@colyseus/schema";

/** Игрок в матче (состояние комнаты Colyseus). */
export class MatchPlayerState extends Schema {
  declare id: string;
  declare nickname: string;
  declare avatarId: number;
  declare isHost: boolean;
  declare isSpy: boolean;
  /** Роль на локации (мирный); у шпиона пусто. */
  declare roleAtLocation: string;
  /** Карточка шпиона (/locations/spyN.webp); у мирных пусто. */
  declare spyCardUrl: string;
  /** Изгнан голосованием — не участвует в голосах и не считается «живым». */
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

/** Корень состояния SpyfallRoom — одна копия для game-server и web (join третьим аргументом). */
export class GameState extends Schema {
  declare phase: string;
  declare matchEndsAt: number;
  /** Ведущий поставил паузу — таймер обсуждения не истекает, при resume дедлайн сдвигается. */
  declare matchPaused: boolean;
  declare matchSessionId: string;
  /** Локация для мирных (шпион на клиенте не показывает). */
  declare locationName: string;
  /** Ключ картинки из БД (`image_key`) — клиент строит URL. */
  declare locationImageKey: string;
  /** Выбранная тема локации (если modeTheme). */
  declare themeText: string;
  declare modeTheme: boolean;
  declare modeRole: boolean;
  declare players: MapSchema<MatchPlayerState>;

  /** См. docs/migration/step5/VOTING_IMPLEMENTATION_PLAN.md */
  declare gameStartedAt: number;
  declare votingDurationSec: number;
  declare firstEarlyVoteAfterAt: number;
  declare earlyVoteCooldownUntil: number;
  declare earlyVotesUsed: number;
  /** Текущая сессия запущена по истечении таймера обсуждения (не досрочно) — финальное голосование. */
  declare voteIsFinal: boolean;
  declare voteStage: string;
  declare voteEndsAt: number;
  declare voteTransitionEndsAt: number;
  declare revoteA: string;
  declare revoteB: string;
  declare stubEliminatedId: string;
  declare earlyVoteAck: MapSchema<string>;
  declare voteBallots: MapSchema<string>;
  /** Пока phase=voting: сколько мс осталось до конца обсуждения на момент входа в голосование (таймер «заморожен»). */
  declare discussionTimerRemainingMs: number;
  /** При phase=ended: причина окончания (например too_few_players). */
  declare gameEndReason: string;

  /** Полноэкранный сплэш матча (изгнание / победа / будущее убийство). Пустая строка — нет сплэша. */
  declare matchSplashType: string;
  /** Серверный epoch ms старта текущего сплэша (синхронизация таймера на клиенте). */
  declare matchSplashAt: number;
  /** Для таймерных сплэшей: epoch ms окончания; 0 — без авто-таймера (победа). */
  declare matchSplashEndsAt: number;
  /** Для voting_kicked_civilian: id изгнанного. */
  declare matchSplashEliminatedId: string;
  /** Доля голосов изгнанного, 0–100. */
  declare matchSplashVotePercent: number;
  /** Если true — после изгнания игра не продолжается (подпись на сплэше изгнания). */
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
