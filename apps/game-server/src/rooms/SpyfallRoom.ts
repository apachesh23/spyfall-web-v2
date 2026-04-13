import type { Client } from "@colyseus/core";
import { Room } from "@colyseus/core";
import {
  WS_CLIENT_MESSAGE,
  WS_SERVER_MESSAGE,
  type MatchJoinOptions,
} from "../matchContract.js";
import { GameState, MatchPlayerState } from "../schema/GameState.js";
import { classifySpyLocationGuess } from "../spyLocationGuess.js";

type SpyfallGameState = InstanceType<typeof GameState>;

/** Синхронизировать с packages/shared `DEFAULT_DISCUSSION_DURATION_MS`. */
const DEFAULT_DISCUSSION_DURATION_MS = 15 * 60 * 1000;
const DEFAULT_VOTING_DURATION_MS = 60_000;

/**
 * PROD: первое досрочное не раньше чем через 3 мин после старта; cooldown между досрочными — 3 мин.
 * Сейчас 10 с — только для разработки (вернуть 3 * 60 * 1000 перед релизом).
 */
const FIRST_EARLY_VOTE_AFTER_MS = 10_000;
const EARLY_VOTE_COOLDOWN_MS = 10_000;

/** Сплэш изгнания после голосования (синхрон с клиентом через matchSplashEndsAt). */
const ELIMINATION_SPLASH_MS = 10_000;
/**
 * Клиент показывает сплэш только после exit оверлея голосования (~MatchVoteRoot strip close + fade).
 * Сдвигаем matchSplashAt/EndsAt, чтобы таймер с 10 с и тик сервера совпадали с моментом появления UI.
 * Подстрой под `getStripCloseMotionWindowSec` + overlayFade в apps/web MatchVoteRoot.
 */
const ELIMINATION_SPLASH_REVEAL_PAD_MS = 900;
/**
 * Временно увеличено для тестов (кандидаты на повтор / голосование не состоялось).
 * Перед релизом вернуть порядка 5_000.
 */
/** Пауза с оверлеем (ничья / не состоялось / повтор не состоялось) перед следующим шагом. */
const VOTE_INTERMISSION_UI_MS = 5_000;
/** Добавка к дедлайнам таймеров голосования: клиент показывает 0 целую секунду, затем переход. */
const VOTE_COUNTDOWN_ZERO_PAD_MS = 1_000;
const SKIP_MARK = "skip";
/** Если таймер обсуждения уже истёк, после выхода из голосования даём ещё время, иначе тик снова уйдёт в vote. */
const DISCUSSION_EXTENSION_AFTER_VOTE_MS = 2 * 60 * 1000;
const MIN_ALIVE_PLAYERS_TO_CONTINUE = 3;

const SPY_GUESS_MAX_ATTEMPTS = 2;
/** Синхрон с `packages/shared/src/spyGuessTiming.ts` → `SPY_GUESS_CINEMATIC_TOTAL_MS`. */
const SPY_GUESS_CINEMATIC_TOTAL_MS = 6_000;
/** Синхрон с `packages/shared/src/spyGuessTiming.ts` → `SPY_GUESS_AUTO_WIN_PHASE_MS`. */
const SPY_GUESS_AUTO_WIN_PHASE_MS = 10_000;
/**
 * Между 1-й и 2-й попыткой (после промаха / отрицательного голосования).
 * В dev — 10 с, как у досрочного голосования; в production — 3 мин.
 */
const SPY_GUESS_COOLDOWN_MS =
  process.env.NODE_ENV === "production" ? 3 * 60 * 1000 : 10_000;
const SPY_GUESS_VOTE_MS = 60 * 1000;

const SPY_KILL_FIRST_UNLOCK_MS =
  process.env.NODE_ENV === "production" ? 3 * 60 * 1000 : 10_000;
const SPY_KILL_COOLDOWN_BETWEEN_MS =
  process.env.NODE_ENV === "production" ? 3 * 60 * 1000 : 10_000;

type RosterRowInput = {
  id?: string;
  nickname?: string;
  avatarId?: number;
  isHost?: boolean;
  isSpy?: boolean;
  roleAtLocation?: string;
  spyCardUrl?: string;
};

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

function earlyMajorityRequired(n: number): number {
  return Math.floor(n / 2) + 1;
}

export class SpyfallRoom extends Room<SpyfallGameState> {
  private clientToPlayerId = new Map<string, string>();
  /** Момент постановки на паузу (только в памяти процесса). */
  private pauseStartedAt: number | null = null;
  /** Последняя сессия голосования была запущена досрочно — влияет на cooldown. */
  private voteTriggeredByEarly = false;
  /** После таймера сплэша изгнания показать победный баннер (иначе — вернуться в обсуждение). */
  private pendingVictoryAfterEliminationSplash: "game_over_civilians_win" | "game_over_spy_win_voting" | null =
    null;

  override onCreate(options: Record<string, unknown> & Partial<MatchJoinOptions>) {
    const matchSessionId = typeof options.matchSessionId === "string" ? options.matchSessionId.trim() : "";
    if (!matchSessionId) {
      throw new Error("SpyfallRoom: matchSessionId is required");
    }

    const durationMs =
      typeof options.discussionDurationMs === "number" && Number.isFinite(options.discussionDurationMs)
        ? Math.max(30_000, Math.min(3_600_000, Math.floor(options.discussionDurationMs)))
        : DEFAULT_DISCUSSION_DURATION_MS;

    const votingMs =
      typeof options.votingDurationMs === "number" && Number.isFinite(options.votingDurationMs)
        ? Math.max(30_000, Math.min(600_000, Math.floor(options.votingDurationMs)))
        : DEFAULT_VOTING_DURATION_MS;

    const rosterRaw = options.roster;
    if (!Array.isArray(rosterRaw) || rosterRaw.length === 0) {
      throw new Error("SpyfallRoom: roster is required and must be non-empty");
    }

    this.setState(new GameState());
    const createdAt = Date.now();
    this.state.matchSessionId = matchSessionId;
    this.state.phase = "discussion";
    this.state.matchEndsAt = createdAt + durationMs;
    this.state.matchPaused = false;

    this.state.gameStartedAt = createdAt;
    this.state.firstEarlyVoteAfterAt = createdAt + FIRST_EARLY_VOTE_AFTER_MS;
    this.state.earlyVoteCooldownUntil = 0;
    this.state.earlyVotesUsed = 0;
    this.state.votingDurationSec = Math.max(30, Math.min(600, Math.floor(votingMs / 1000)));
    this.state.voteStage = "idle";
    this.state.voteEndsAt = 0;
    this.state.voteTransitionEndsAt = 0;
    this.state.revoteA = "";
    this.state.revoteB = "";
    this.state.stubEliminatedId = "";

    this.state.locationName = typeof options.locationName === "string" ? options.locationName : "";
    this.state.locationImageKey =
      typeof options.locationImageKey === "string" ? options.locationImageKey : "";
    this.state.themeText = typeof options.themeText === "string" ? options.themeText : "";
    this.state.modeTheme = bool(options.modeTheme);
    this.state.modeRole = bool(options.modeRole);
    this.state.modeHiddenThreat = bool(options.modeHiddenThreat);
    if (this.state.modeHiddenThreat) {
      const firstUnlock = createdAt + SPY_KILL_FIRST_UNLOCK_MS;
      this.state.spyDiscussActionsUnlockAt = firstUnlock;
      this.state.spyKillCooldownUntil = firstUnlock;
    } else {
      this.state.spyDiscussActionsUnlockAt = 0;
      this.state.spyKillCooldownUntil = 0;
    }

    for (const raw of rosterRaw) {
      const row = raw as RosterRowInput;
      const id = typeof row.id === "string" ? row.id.trim() : "";
      if (!id) continue;
      const p = new MatchPlayerState();
      p.id = id;
      p.nickname = typeof row.nickname === "string" ? row.nickname.slice(0, 48) || "Игрок" : "Игрок";
      p.avatarId = num(row.avatarId) > 0 ? Math.floor(num(row.avatarId)) : 1;
      p.isHost = bool(row.isHost);
      p.isSpy = bool(row.isSpy);
      p.roleAtLocation = typeof row.roleAtLocation === "string" ? row.roleAtLocation : "";
      p.spyCardUrl = typeof row.spyCardUrl === "string" ? row.spyCardUrl : "";
      p.eliminated = false;
      p.deathReason = "";
      this.state.players.set(id, p);
    }

    this.autoDispose = true;

    this.onMessage(WS_CLIENT_MESSAGE.ping, (client: Client, payload: { t?: number }) => {
      client.send("pong", { t: payload?.t ?? 0, serverTime: Date.now() });
    });

    this.onMessage(WS_CLIENT_MESSAGE.matchPause, (client: Client) => {
      const playerId = this.clientToPlayerId.get(client.sessionId);
      if (!playerId) return;
      const p = this.state.players.get(playerId);
      if (!p?.isHost) return;
      /** Реальная пауза ведущего только в обсуждении; во время голосования таймер обсуждения уже «заморожен» в state. */
      if (this.state.phase !== "discussion") return;
      if (this.state.matchPaused) return;
      if (this.state.matchEndsAt <= 0) return;
      this.pauseStartedAt = Date.now();
      this.state.matchPaused = true;
    });

    this.onMessage(WS_CLIENT_MESSAGE.matchResume, (client: Client) => {
      const playerId = this.clientToPlayerId.get(client.sessionId);
      if (!playerId) return;
      const p = this.state.players.get(playerId);
      if (!p?.isHost) return;
      if (this.state.phase !== "discussion") return;
      if (!this.state.matchPaused || this.pauseStartedAt == null) return;
      const delta = Date.now() - this.pauseStartedAt;
      this.state.matchEndsAt += delta;
      this.state.matchPaused = false;
      this.pauseStartedAt = null;
    });

    this.onMessage(WS_CLIENT_MESSAGE.earlyVoteToggle, (client: Client) => {
      const playerId = this.clientToPlayerId.get(client.sessionId);
      if (!playerId) return;
      if (this.state.phase !== "discussion") return;
      const voter = this.state.players.get(playerId);
      if (!voter || voter.eliminated) return;
      if (this.state.earlyVotesUsed >= 2) return;
      const now = Date.now();
      if (now < Math.max(this.state.firstEarlyVoteAfterAt, this.state.earlyVoteCooldownUntil)) return;

      if (this.state.earlyVoteAck.has(playerId)) {
        this.state.earlyVoteAck.delete(playerId);
      } else {
        this.state.earlyVoteAck.set(playerId, "1");
      }

      const alive = this.countAlive();
      const need = earlyMajorityRequired(alive);
      let ack = 0;
      this.state.earlyVoteAck.forEach((_, id) => {
        if (!this.state.players.get(id)?.eliminated) ack++;
      });
      if (ack >= need) {
        this.startVotingSession(true);
      }
    });

    this.onMessage(WS_CLIENT_MESSAGE.voteCast, (client: Client, payload: { targetId?: string }) => {
      const playerId = this.clientToPlayerId.get(client.sessionId);
      if (!playerId) return;
      if (this.state.phase !== "voting") return;
      const me = this.state.players.get(playerId);
      if (!me || me.eliminated) return;
      const stage = this.state.voteStage;
      if (stage !== "collect1" && stage !== "collect2") return;
      const targetId = typeof payload?.targetId === "string" ? payload.targetId.trim() : "";
      if (!targetId) return;

      if (stage === "collect1") {
        if (targetId === playerId) return;
        const t = this.state.players.get(targetId);
        if (!t || t.eliminated) return;
        this.state.voteBallots.set(playerId, targetId);
        return;
      }

      const a = this.state.revoteA;
      const b = this.state.revoteB;
      if (playerId === a || playerId === b) return;
      if (targetId !== a && targetId !== b) return;
      this.state.voteBallots.set(playerId, targetId);
    });

    this.onMessage(WS_CLIENT_MESSAGE.voteSkip, (client: Client) => {
      const playerId = this.clientToPlayerId.get(client.sessionId);
      if (!playerId) return;
      if (this.state.phase !== "voting") return;
      if (this.state.voteIsFinal) return;
      const me = this.state.players.get(playerId);
      if (!me || me.eliminated) return;
      const stage = this.state.voteStage;
      if (stage !== "collect1" && stage !== "collect2") return;
      if (stage === "collect2") {
        const a = this.state.revoteA;
        const b = this.state.revoteB;
        if (playerId === a || playerId === b) return;
      }
      this.state.voteBallots.set(playerId, SKIP_MARK);
    });

    this.onMessage(WS_CLIENT_MESSAGE.spyGuessSubmit, (client: Client, payload: { text?: string }) => {
      const playerId = this.clientToPlayerId.get(client.sessionId);
      if (!playerId) return;
      if (this.state.phase !== "discussion") return;
      if (this.state.spyGuessVoteEndsAt > 0) return;
      if (this.state.matchSplashType === "spy_kill") return;

      const me = this.state.players.get(playerId);
      if (!me?.isSpy || me.eliminated) return;
      if (this.state.spyGuessAttemptsUsed >= SPY_GUESS_MAX_ATTEMPTS) return;
      if (
        this.state.modeHiddenThreat &&
        this.state.spyGuessAttemptsUsed + this.state.spyKillAttemptsUsed >= SPY_GUESS_MAX_ATTEMPTS
      ) {
        return;
      }

      const now = Date.now();
      if (this.state.modeHiddenThreat && now < this.state.spyDiscussActionsUnlockAt) return;
      if (now < this.state.spyGuessCooldownUntil) return;

      const raw = typeof payload?.text === "string" ? payload.text : "";
      const text = raw.trim().slice(0, 200);
      if (!text) return;

      const secret = this.state.locationName.trim();
      /** Пустое имя локации в опциях комнаты — не считаем промахом (иначе сгорают попытки без фазы голосования). */
      const cls = secret ? classifySpyLocationGuess(secret, text) : ("vote" as const);
      /** Как при `startVotingSession`: пока идёт угадайка, глобальный таймер обсуждения не «съедается». */
      if (this.state.matchEndsAt > 0) {
        this.state.discussionTimerRemainingMs = Math.max(0, this.state.matchEndsAt - now);
      }
      const voteStartsAt = now + SPY_GUESS_CINEMATIC_TOTAL_MS;
      if (cls === "win") {
        this.state.spyGuessText = text;
        this.state.spyGuessSpyId = playerId;
        this.state.spyGuessBallots.clear();
        this.state.spyGuessIsAutoWin = true;
        this.state.spyGuessVoteStartsAt = voteStartsAt;
        this.state.spyGuessVoteEndsAt = voteStartsAt + SPY_GUESS_AUTO_WIN_PHASE_MS;
        return;
      }

      this.state.spyGuessText = text;
      this.state.spyGuessSpyId = playerId;
      this.state.spyGuessBallots.clear();
      this.state.spyGuessIsAutoWin = false;
      this.state.spyGuessVoteStartsAt = voteStartsAt;
      this.state.spyGuessVoteEndsAt = voteStartsAt + SPY_GUESS_VOTE_MS;
    });

    this.onMessage(WS_CLIENT_MESSAGE.spyGuessVoteCast, (client: Client, payload: { vote?: string }) => {
      const playerId = this.clientToPlayerId.get(client.sessionId);
      if (!playerId) return;
      if (this.state.phase !== "discussion") return;
      const now = Date.now();
      if (this.state.spyGuessVoteEndsAt <= 0) return;
      if (this.state.spyGuessIsAutoWin) return;
      if (this.state.spyGuessVoteStartsAt > 0 && now < this.state.spyGuessVoteStartsAt) return;

      const me = this.state.players.get(playerId);
      if (!me || me.eliminated) return;
      const spyId = this.state.spyGuessSpyId;
      if (!spyId || playerId === spyId) return;

      const raw = typeof payload?.vote === "string" ? payload.vote.trim().toLowerCase() : "";
      if (raw !== "yes" && raw !== "no") return;

      const eligible = this.getAlivePlayerIds().filter((id) => id !== spyId);
      if (!eligible.includes(playerId)) return;

      this.state.spyGuessBallots.set(playerId, raw);
    });

    this.onMessage(WS_CLIENT_MESSAGE.spyKillSubmit, (client: Client, payload: { targetId?: string }) => {
      const playerId = this.clientToPlayerId.get(client.sessionId);
      if (!playerId) return;
      if (!this.state.modeHiddenThreat) return;
      if (this.state.phase !== "discussion") return;
      if (this.state.spyGuessVoteEndsAt > 0) return;
      if (this.state.matchSplashType === "spy_kill") return;

      const me = this.state.players.get(playerId);
      if (!me?.isSpy || me.eliminated) return;

      const now = Date.now();
      if (now < this.state.spyKillCooldownUntil) return;
      if (this.state.spyKillAttemptsUsed >= SPY_GUESS_MAX_ATTEMPTS) return;
      if (this.state.spyGuessAttemptsUsed + this.state.spyKillAttemptsUsed >= SPY_GUESS_MAX_ATTEMPTS) return;

      const aliveBefore = this.countAlive();
      if (aliveBefore < 4) return;

      const targetId = typeof payload?.targetId === "string" ? payload.targetId.trim() : "";
      if (!targetId || targetId === playerId) return;
      const target = this.state.players.get(targetId);
      if (!target || target.eliminated || target.isSpy) return;

      this.enterSpyKillSplash(playerId, targetId, now);
    });

    this.setSimulationInterval(() => {
      this.tickTimer();
    }, 1000);

    console.log(
      `[SpyfallRoom] onCreate roomId=${this.roomId} matchSessionId=${matchSessionId} matchEndsAt=${this.state.matchEndsAt} players.size=${this.state.players.size}`,
    );
  }

  override onJoin(client: Client, options: Partial<MatchJoinOptions>) {
    const playerId = typeof options.playerId === "string" ? options.playerId.trim() : "";
    if (!playerId) {
      client.leave(4000, "playerId required");
      return;
    }

    const existing = this.state.players.get(playerId);
    if (!existing) {
      client.leave(4000, "not in roster");
      return;
    }

    this.clientToPlayerId.set(client.sessionId, playerId);

    const nicknameRaw = typeof options.nickname === "string" ? options.nickname.trim() : "";
    if (nicknameRaw) {
      existing.nickname = nicknameRaw.slice(0, 48);
    }

    const isSpy = existing.isSpy;
    client.send(WS_SERVER_MESSAGE.matchAssignment, {
      /** Тему видят и шпион, и мирные — подсказка для беседы без знания локации. */
      themeText: this.state.themeText,
      modeTheme: this.state.modeTheme,
      modeRole: isSpy ? false : this.state.modeRole,
      roleAtLocation: isSpy ? "" : existing.roleAtLocation,
    });

    console.log(
      `[SpyfallRoom] onJoin roomId=${this.roomId} playerId=${playerId} nickname=${existing.nickname} players.size=${this.state.players.size}`,
    );
  }

  override onLeave(client: Client) {
    const playerId = this.clientToPlayerId.get(client.sessionId);
    this.clientToPlayerId.delete(client.sessionId);
    if (playerId) {
      // Оставляем игрока в state — переподключение и список на экране не ломаются.
    }
  }

  private getOrderedPlayerIds(): string[] {
    const out: string[] = [];
    this.state.players.forEach((_, id) => out.push(id));
    return out;
  }

  private getAlivePlayerIds(): string[] {
    const out: string[] = [];
    this.state.players.forEach((p, id) => {
      if (!p.eliminated) out.push(id);
    });
    return out;
  }

  private countAlive(): number {
    let n = 0;
    this.state.players.forEach((p) => {
      if (!p.eliminated) n++;
    });
    return n;
  }

  private clearMatchSplashFields() {
    this.state.matchSplashType = "";
    this.state.matchSplashAt = 0;
    this.state.matchSplashEndsAt = 0;
    this.state.matchSplashEliminatedId = "";
    this.state.matchSplashVotePercent = 0;
    this.state.matchSplashEliminationGameOver = false;
  }

  /**
   * После фазы угадайки шпиона: восстановить дедлайн обсуждения по сохранённому остатку (аналог `returnToDiscussion`).
   */
  private reanchorMatchEndsAfterSpyGuess(now: number) {
    const saved = this.state.discussionTimerRemainingMs;
    this.state.discussionTimerRemainingMs = 0;
    if (this.state.matchEndsAt <= 0) return;
    this.state.matchEndsAt = now + Math.max(0, saved);
    if (this.state.matchEndsAt <= now) {
      this.state.matchEndsAt = now + DISCUSSION_EXTENSION_AFTER_VOTE_MS;
    }
  }

  private startVotingSession(fromEarly: boolean) {
    const now = Date.now();
    this.state.discussionTimerRemainingMs = Math.max(0, this.state.matchEndsAt - now);

    this.pendingVictoryAfterEliminationSplash = null;
    this.clearMatchSplashFields();

    this.state.voteBallots.clear();
    this.state.voteTransitionEndsAt = 0;
    this.state.revoteA = "";
    this.state.revoteB = "";
    this.state.stubEliminatedId = "";

    if (fromEarly) {
      this.state.earlyVotesUsed += 1;
      this.state.earlyVoteAck.clear();
    }
    this.voteTriggeredByEarly = fromEarly;
    this.state.voteIsFinal = !fromEarly;

    this.state.phase = "voting";
    this.state.voteStage = "collect1";
    this.state.voteEndsAt = now + this.state.votingDurationSec * 1000 + VOTE_COUNTDOWN_ZERO_PAD_MS;
  }

  private returnToDiscussion() {
    const now = Date.now();
    const savedDiscussionMs = this.state.discussionTimerRemainingMs;
    this.state.discussionTimerRemainingMs = 0;

    this.pendingVictoryAfterEliminationSplash = null;
    this.clearMatchSplashFields();

    this.state.phase = "discussion";
    this.state.voteStage = "idle";
    this.state.voteEndsAt = 0;
    this.state.voteTransitionEndsAt = 0;
    this.state.revoteA = "";
    this.state.revoteB = "";
    this.state.stubEliminatedId = "";
    this.state.voteBallots.clear();
    this.state.earlyVoteAck.clear();
    if (this.voteTriggeredByEarly) {
      this.state.earlyVoteCooldownUntil = now + EARLY_VOTE_COOLDOWN_MS;
    }
    this.voteTriggeredByEarly = false;
    this.state.voteIsFinal = false;

    this.state.matchEndsAt = now + Math.max(0, savedDiscussionMs);
    if (this.state.matchEndsAt <= now) {
      this.state.matchEndsAt = now + DISCUSSION_EXTENSION_AFTER_VOTE_MS;
    }
  }

  /** Победитель после изгнания по числу живых шпионов / мирных. */
  private victoryAfterEliminationCounts(spies: number, civs: number): "game_over_civilians_win" | "game_over_spy_win_voting" {
    if (spies === 0) return "game_over_civilians_win";
    if (spies >= civs) return "game_over_spy_win_voting";
    return "game_over_civilians_win";
  }

  private enterIntermissionNoVote() {
    this.state.voteStage = "intermission_no_vote";
    this.state.voteEndsAt = 0;
    this.state.voteTransitionEndsAt = Date.now() + VOTE_INTERMISSION_UI_MS + VOTE_COUNTDOWN_ZERO_PAD_MS;
  }

  private enterIntermissionRevoteNoVote() {
    this.state.voteStage = "intermission_revote_no_vote";
    this.state.voteEndsAt = 0;
    this.state.voteTransitionEndsAt = Date.now() + VOTE_INTERMISSION_UI_MS + VOTE_COUNTDOWN_ZERO_PAD_MS;
  }

  private enterIntermissionTie(a: string, b: string) {
    this.state.revoteA = a;
    this.state.revoteB = b;
    this.state.voteStage = "intermission_tie";
    this.state.voteEndsAt = 0;
    this.state.voteTransitionEndsAt = Date.now() + VOTE_INTERMISSION_UI_MS + VOTE_COUNTDOWN_ZERO_PAD_MS;
  }

  private enterStub(eliminatedId: string, votePercent: number) {
    const target = this.state.players.get(eliminatedId);
    if (target) {
      target.eliminated = true;
      target.deathReason = "voted";
    }

    const alive = this.countAlive();

    let spies = 0;
    let civs = 0;
    this.state.players.forEach((p) => {
      if (p.eliminated) return;
      if (p.isSpy) spies += 1;
      else civs += 1;
    });

    const tooFewToContinue = alive < MIN_ALIVE_PLAYERS_TO_CONTINUE;

    let gameOver = false;
    let victory: "game_over_civilians_win" | "game_over_spy_win_voting" | null = null;
    if (tooFewToContinue) {
      gameOver = true;
      victory = this.victoryAfterEliminationCounts(spies, civs);
    } else if (spies === 0) {
      gameOver = true;
      victory = "game_over_civilians_win";
    } else if (spies >= civs) {
      gameOver = true;
      victory = "game_over_spy_win_voting";
    }

    this.pendingVictoryAfterEliminationSplash = gameOver ? victory : null;

    const t = Date.now() + ELIMINATION_SPLASH_REVEAL_PAD_MS;
    const end = t + ELIMINATION_SPLASH_MS + VOTE_COUNTDOWN_ZERO_PAD_MS;

    this.state.stubEliminatedId = eliminatedId;
    this.state.voteStage = "elimination_splash";
    this.state.voteEndsAt = 0;
    this.state.voteTransitionEndsAt = end;

    this.state.matchSplashType = "voting_kicked_civilian";
    this.state.matchSplashAt = t;
    this.state.matchSplashEndsAt = end;
    this.state.matchSplashEliminatedId = eliminatedId;
    this.state.matchSplashVotePercent = Math.max(0, Math.min(100, Math.round(votePercent)));
    this.state.matchSplashEliminationGameOver = gameOver;
  }

  private enterSpyKillSplash(_spyId: string, targetId: string, now: number) {
    const target = this.state.players.get(targetId);
    if (!target || target.eliminated) return;

    if (this.state.matchEndsAt > 0) {
      this.state.discussionTimerRemainingMs = Math.max(0, this.state.matchEndsAt - now);
    }

    target.eliminated = true;
    target.deathReason = "killed";
    this.state.spyKillAttemptsUsed += 1;

    const alive = this.countAlive();

    let spies = 0;
    let civs = 0;
    this.state.players.forEach((p) => {
      if (p.eliminated) return;
      if (p.isSpy) spies += 1;
      else civs += 1;
    });

    const tooFewToContinue = alive < MIN_ALIVE_PLAYERS_TO_CONTINUE;

    let gameOver = false;
    let victory: "game_over_civilians_win" | "game_over_spy_win_voting" | null = null;
    if (tooFewToContinue) {
      gameOver = true;
      victory = this.victoryAfterEliminationCounts(spies, civs);
    } else if (spies === 0) {
      gameOver = true;
      victory = "game_over_civilians_win";
    } else if (spies >= civs) {
      gameOver = true;
      victory = "game_over_spy_win_voting";
    }

    this.pendingVictoryAfterEliminationSplash = gameOver ? victory : null;

    const t = now + ELIMINATION_SPLASH_REVEAL_PAD_MS;
    const end = t + ELIMINATION_SPLASH_MS + VOTE_COUNTDOWN_ZERO_PAD_MS;

    this.state.matchSplashType = "spy_kill";
    this.state.matchSplashAt = t;
    this.state.matchSplashEndsAt = end;
    this.state.matchSplashEliminatedId = targetId;
    this.state.matchSplashVotePercent = 0;
    this.state.matchSplashEliminationGameOver = gameOver;
  }

  private finishSpyKillSplash(now: number) {
    const pending = this.pendingVictoryAfterEliminationSplash;
    this.pendingVictoryAfterEliminationSplash = null;
    this.clearMatchSplashFields();

    if (this.state.spyKillAttemptsUsed < SPY_GUESS_MAX_ATTEMPTS) {
      this.state.spyKillCooldownUntil = now + SPY_KILL_COOLDOWN_BETWEEN_MS;
    }

    this.reanchorMatchEndsAfterSpyGuess(now);

    if (pending) {
      this.state.phase = "ended";
      this.state.gameEndReason = pending === "game_over_civilians_win" ? "civilians_win" : "spies_win_voting";
      this.state.voteStage = "idle";
      this.state.voteEndsAt = 0;
      this.state.voteTransitionEndsAt = 0;
      this.state.revoteA = "";
      this.state.revoteB = "";
      this.state.stubEliminatedId = "";
      this.state.discussionTimerRemainingMs = 0;
      this.state.voteBallots.clear();
      this.state.earlyVoteAck.clear();
      this.voteTriggeredByEarly = false;
      this.state.voteIsFinal = false;

      const t = Date.now();
      this.state.matchSplashType = pending;
      this.state.matchSplashAt = t;
      this.state.matchSplashEndsAt = 0;
    }
  }

  private finishEliminationSplash() {
    const pending = this.pendingVictoryAfterEliminationSplash;
    this.pendingVictoryAfterEliminationSplash = null;

    this.state.stubEliminatedId = "";
    this.state.voteTransitionEndsAt = 0;
    this.clearMatchSplashFields();

    if (pending) {
      this.state.phase = "ended";
      this.state.gameEndReason = pending === "game_over_civilians_win" ? "civilians_win" : "spies_win_voting";
      this.state.voteStage = "idle";
      this.state.voteEndsAt = 0;
      this.state.revoteA = "";
      this.state.revoteB = "";
      this.state.discussionTimerRemainingMs = 0;
      this.state.voteBallots.clear();
      this.state.earlyVoteAck.clear();
      this.voteTriggeredByEarly = false;
      this.state.voteIsFinal = false;

      const t = Date.now();
      this.state.matchSplashType = pending;
      this.state.matchSplashAt = t;
      this.state.matchSplashEndsAt = 0;
      return;
    }

    this.returnToDiscussion();
  }

  private startCollect2() {
    this.state.voteBallots.clear();
    this.state.voteStage = "collect2";
    this.state.voteEndsAt = Date.now() + this.state.votingDurationSec * 1000 + VOTE_COUNTDOWN_ZERO_PAD_MS;
    this.state.voteTransitionEndsAt = 0;
  }

  private tallyRound1(): { counts: Map<string, number>; allSkip: boolean } {
    const ids = this.getAlivePlayerIds();
    const counts = new Map<string, number>();
    for (const id of ids) {
      const v = this.state.voteBallots.get(id);
      if (v === SKIP_MARK || v === undefined) continue;
      if (v === id) continue;
      const target = this.state.players.get(v);
      if (!target || target.eliminated) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const allHave = ids.length > 0 && ids.every((x) => this.state.voteBallots.has(x));
    const allSkip = allHave && ids.every((x) => this.state.voteBallots.get(x) === SKIP_MARK);
    return { counts, allSkip };
  }

  private shouldResolveCollect1(): boolean {
    const ids = this.getAlivePlayerIds();
    if (ids.length === 0) return false;
    const now = Date.now();
    if (now >= this.state.voteEndsAt) return true;
    return ids.every((id) => this.state.voteBallots.has(id));
  }

  private shouldResolveCollect2(): boolean {
    const a = this.state.revoteA;
    const b = this.state.revoteB;
    const voters = this.getAlivePlayerIds().filter((id) => id !== a && id !== b);
    const now = Date.now();
    if (voters.length === 0) return true;
    if (now >= this.state.voteEndsAt) return true;
    return voters.every((id) => this.state.voteBallots.has(id));
  }

  private resolveRound1() {
    const { counts, allSkip } = this.tallyRound1();
    if (allSkip) {
      this.enterIntermissionNoVote();
      return;
    }
    let max = 0;
    for (const v of counts.values()) max = Math.max(max, v);
    if (max === 0) {
      this.enterIntermissionNoVote();
      return;
    }
    const leaders = [...counts.entries()].filter(([, c]) => c === max).map(([id]) => id);
    if (leaders.length === 1) {
      const ids = this.getAlivePlayerIds();
      const id = leaders[0]!;
      const maxVotes = counts.get(id) ?? 0;
      const denom = ids.length;
      const pct = denom > 0 ? Math.round((maxVotes / denom) * 100) : 0;
      this.enterStub(id, pct);
    } else if (leaders.length === 2) {
      this.enterIntermissionTie(leaders[0]!, leaders[1]!);
    } else {
      this.enterIntermissionNoVote();
    }
  }

  private resolveRound2() {
    const a = this.state.revoteA;
    const b = this.state.revoteB;
    const voters = this.getAlivePlayerIds().filter((id) => id !== a && id !== b);
    let ca = 0;
    let cb = 0;
    for (const voter of voters) {
      const v = this.state.voteBallots.get(voter);
      if (v === SKIP_MARK || v === undefined) continue;
      if (v === a) ca++;
      else if (v === b) cb++;
    }
    if (ca === 0 && cb === 0) {
      this.enterIntermissionRevoteNoVote();
    } else if (ca > cb) {
      const pct = voters.length > 0 ? Math.round((ca / voters.length) * 100) : 0;
      this.enterStub(a, pct);
    } else if (cb > ca) {
      const pct = voters.length > 0 ? Math.round((cb / voters.length) * 100) : 0;
      this.enterStub(b, pct);
    } else {
      this.enterIntermissionRevoteNoVote();
    }
  }

  /** Любое «голосование не состоялось» в финале (раунд 1 или ничья во 2-м) — победа шпионов после проходного экрана. */
  private endFinalVotingNoOutcomeAsSpyWin() {
    this.pendingVictoryAfterEliminationSplash = null;
    this.clearMatchSplashFields();

    this.state.phase = "ended";
    this.state.gameEndReason = "spies_win_voting";
    this.state.voteStage = "idle";
    this.state.voteEndsAt = 0;
    this.state.voteTransitionEndsAt = 0;
    this.state.revoteA = "";
    this.state.revoteB = "";
    this.state.stubEliminatedId = "";
    this.state.discussionTimerRemainingMs = 0;
    this.state.voteBallots.clear();
    this.state.earlyVoteAck.clear();
    this.voteTriggeredByEarly = false;
    this.state.voteIsFinal = false;

    const t = Date.now();
    this.state.matchSplashType = "game_over_spy_win_voting";
    this.state.matchSplashAt = t;
    this.state.matchSplashEndsAt = 0;
  }

  private advanceAfterIntermission(stage: string) {
    if (stage === "intermission_no_vote" || stage === "intermission_revote_no_vote") {
      if (this.state.voteIsFinal) {
        this.endFinalVotingNoOutcomeAsSpyWin();
        return;
      }
      this.returnToDiscussion();
      return;
    }
    if (stage === "intermission_tie") {
      this.startCollect2();
    }
  }

  private tickTimer() {
    if (this.state.phase === "ended") {
      return;
    }

    const now = Date.now();

    if (this.state.phase === "discussion") {
      if (this.state.spyGuessVoteEndsAt > 0) {
        this.tickSpyGuessVote(now);
        return;
      }
      if (this.state.matchSplashType === "spy_kill" && this.state.matchSplashEndsAt > 0) {
        if (now >= this.state.matchSplashEndsAt) {
          this.finishSpyKillSplash(now);
        }
        return;
      }
      if (this.state.matchPaused) return;
      if (this.state.matchEndsAt <= 0) return;
      if (now < this.state.matchEndsAt) return;
      this.startVotingSession(false);
      return;
    }

    if (this.state.phase !== "voting") return;

    const stage = this.state.voteStage;

    if (stage === "collect1") {
      if (this.shouldResolveCollect1()) this.resolveRound1();
      return;
    }
    if (stage === "collect2") {
      if (this.shouldResolveCollect2()) this.resolveRound2();
      return;
    }
    if (stage === "elimination_splash") {
      if (this.state.matchSplashEndsAt > 0 && now >= this.state.matchSplashEndsAt) {
        this.finishEliminationSplash();
      }
      return;
    }
    if (
      stage === "intermission_no_vote" ||
      stage === "intermission_tie" ||
      stage === "intermission_revote_no_vote"
    ) {
      if (this.state.voteTransitionEndsAt > 0 && now >= this.state.voteTransitionEndsAt) {
        this.advanceAfterIntermission(stage);
      }
    }
  }

  private tickSpyGuessVote(now: number) {
    const ends = this.state.spyGuessVoteEndsAt;
    if (ends <= 0) return;
    const starts = this.state.spyGuessVoteStartsAt;
    if (starts > 0 && now < starts) return;
    const spyId = this.state.spyGuessSpyId;
    if (!spyId) {
      this.reanchorMatchEndsAfterSpyGuess(now);
      this.clearSpyGuessVoteFields();
      return;
    }
    if (this.state.spyGuessIsAutoWin) {
      if (now >= ends) this.endGameSpyWinGuess();
      return;
    }
    const eligible = this.getAlivePlayerIds().filter((id) => id !== spyId);
    const allVoted =
      eligible.length > 0 && eligible.every((id) => this.state.spyGuessBallots.has(id));
    if (!allVoted && now < ends) return;
    this.resolveSpyGuessVote(now);
  }

  private clearSpyGuessVoteFields() {
    this.state.spyGuessVoteEndsAt = 0;
    this.state.spyGuessVoteStartsAt = 0;
    this.state.spyGuessIsAutoWin = false;
    this.state.spyGuessText = "";
    this.state.spyGuessSpyId = "";
    this.state.spyGuessBallots.clear();
  }

  private resolveSpyGuessVote(now: number) {
    const spyId = this.state.spyGuessSpyId;
    const eligible = spyId ? this.getAlivePlayerIds().filter((id) => id !== spyId) : [];
    let yes = 0;
    let no = 0;
    for (const id of eligible) {
      const v = this.state.spyGuessBallots.get(id);
      if (v === "yes") yes++;
      else if (v === "no") no++;
    }
    const spyWins = yes > no;

    this.clearSpyGuessVoteFields();

    if (spyWins) {
      this.endGameSpyWinGuess();
      return;
    }

    this.state.spyGuessAttemptsUsed += 1;
    if (this.state.spyGuessAttemptsUsed < SPY_GUESS_MAX_ATTEMPTS) {
      this.state.spyGuessCooldownUntil = now + SPY_GUESS_COOLDOWN_MS;
    }

    this.reanchorMatchEndsAfterSpyGuess(now);
  }

  private endGameSpyWinGuess() {
    this.pendingVictoryAfterEliminationSplash = null;
    this.clearMatchSplashFields();
    this.clearSpyGuessVoteFields();

    this.state.phase = "ended";
    this.state.gameEndReason = "spy_win_guess";
    this.state.voteStage = "idle";
    this.state.voteEndsAt = 0;
    this.state.voteTransitionEndsAt = 0;
    this.state.revoteA = "";
    this.state.revoteB = "";
    this.state.stubEliminatedId = "";
    this.state.discussionTimerRemainingMs = 0;
    this.state.voteBallots.clear();
    this.state.earlyVoteAck.clear();
    this.voteTriggeredByEarly = false;
    this.state.voteIsFinal = false;

    const t = Date.now();
    this.state.matchSplashType = "game_over_spy_win";
    this.state.matchSplashAt = t;
    this.state.matchSplashEndsAt = 0;
  }
}
