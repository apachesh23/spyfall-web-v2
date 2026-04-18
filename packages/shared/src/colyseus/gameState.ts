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
  /** Роль на локации при modeRole (и у шпионов — своя карточка роли, без раскрытия союзников). */
  declare roleAtLocation: string;
  /** Карточка шпиона (/locations/spyN.webp); у мирных пусто. */
  declare spyCardUrl: string;
  /** Изгнан голосованием — не участвует в голосах и не считается «живым». */
  declare eliminated: boolean;
  /** `voted` — изгнание голосованием; `killed` — устранение шпионом; пусто — ещё в игре. */
  declare deathReason: string;
  /** Попытки угадать локацию этим шпионом (при ≥2 шпионах 0|1; в соло — 0, лимит в spyGuessAttemptsUsed). */
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

/** Корень состояния SpyfallRoom — одна копия для game-server и web (join третьим аргументом). */
export class GameState extends Schema {
  declare phase: string;
  declare matchEndsAt: number;
  /** Ведущий поставил паузу — таймер обсуждения не истекает, при resume дедлайн сдвигается. */
  declare matchPaused: boolean;
  declare matchSessionId: string;
  /** Публичный id страницы итогов матча. */
  declare historyShareHash: string;
  /** UUID комнаты в БД (привязка match_history). */
  declare roomId: string;
  /** Локация для мирных (шпион на клиенте не показывает). */
  declare locationName: string;
  /** Ключ картинки из БД (`image_key`) — клиент строит URL. */
  declare locationImageKey: string;
  /** Выбранная тема локации (если modeTheme). */
  declare themeText: string;
  declare modeTheme: boolean;
  declare modeRole: boolean;
  /** Режим лобби «Скрытая угроза»: две кнопки шпиона, общий лимит действий с угадыванием. */
  declare modeHiddenThreat: boolean;
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

  declare spyGuessAttemptsUsed: number;
  declare spyGuessCooldownUntil: number;
  declare spyGuessVoteEndsAt: number;
  /** Epoch ms: до этого момента голоса не принимаются и таймер сплэша не «идёт». */
  declare spyGuessVoteStartsAt: number;
  /** Точное совпадение с локацией — после cinematic только инфо-фаза, без бюллетеней. */
  declare spyGuessIsAutoWin: boolean;
  declare spyGuessText: string;
  declare spyGuessSpyId: string;
  declare spyGuessBallots: MapSchema<string>;

  /** Сколько устранений уже зафиксировано (0–2), счётчик растёт в начале сплэша убийства. */
  declare spyKillAttemptsUsed: number;
  /** Epoch ms: до этого момента кнопка «Устранить» заблокирована (первый раз — от старта игры). */
  declare spyKillCooldownUntil: number;
  /**
   * Режим «Скрытая угроза»: до этого момента недоступны и угадывание, и устранение (первые 3 мин с старта).
   * Не сдвигается при перезарядках между попытками.
   */
  declare spyDiscussActionsUnlockAt: number;

  declare initialSpyCount: number;
  declare voteFinalSpiesRemaining: number;
  /** Порядок отображения игроков в UI: id через `|`. Задаётся при старте (рандом) и по кнопке ведущего. */
  declare playerDisplayOrder: string;

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
    this.playerDisplayOrder = "";
    this.historyShareHash = "";
    this.roomId = "";
  }
}
defineTypes(GameState, {
  phase: "string",
  matchEndsAt: "number",
  matchPaused: "boolean",
  matchSessionId: "string",
  historyShareHash: "string",
  roomId: "string",
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
  playerDisplayOrder: "string",
});
