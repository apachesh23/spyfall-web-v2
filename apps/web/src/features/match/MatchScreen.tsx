"use client";

import { Client, type Room } from "colyseus.js";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  COLYSEUS_ROOM_NAME,
  GameState,
  WS_CLIENT_MESSAGE,
  WS_SERVER_MESSAGE,
  type MatchAssignmentPayload,
} from "@spyfall/shared";
import {
  clearStashedRoomPlayer,
  peekStashedRoomPlayer,
} from "@/lib/roomIdentityRecovery";
import { supabase } from "@/lib/supabase/client";
import { normalizeRoomSettings } from "@/lib/normalizeRoomSettings";
import { resolveColyseusUrlForBrowser } from "@/lib/env";
import {
  setMatchMusicBootstrapHandler,
  startGameMusic,
  startSpyGuessMusic,
  startVoteMusic,
  stopSpyGuessMusic,
  stopVoteMusic,
} from "@/lib/sound";
import type { Settings } from "@/types/room";
import type { AvatarId } from "@/lib/avatars";
import type { GamePlayer, Player } from "@/types/player";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useRouteLoaderStore } from "@/store/route-loader-store";
import { useReactions } from "@/features/reactions/context";
import { FooterBar } from "@/shared/components/layout/footer-bar/FooterBar";
import { MatchPauseProvider } from "./context/MatchPauseContext";
import { useMatchReactionsChannel } from "./hooks/useMatchReactionsChannel";
import { useMatchPlayUiReady } from "./context/MatchPlayUiReadyContext";
import {
  DebugPanelDev,
  MatchColyseusSplashLayer,
  MATCH_COLYSEUS_SPLASH_TYPES,
  MatchGameHostButtons,
  MatchHintQuestionButton,
  MatchPauseGrayscaleOverlay,
} from "./components";
import { MatchSpyGuessEmergencyIntroLayer } from "./components/MatchSpyGuess/MatchSpyGuessEmergencyIntroLayer";
import { MatchSpyGuessLocationModal } from "./components/MatchSpyGuess/MatchSpyGuessLocationModal";
import { MatchSpyEliminateModal } from "./components/MatchSpyEliminateModal/MatchSpyEliminateModal";
import { MatchSpyGuessVoteOverlay } from "./components/MatchSpyGuess/MatchSpyGuessVoteOverlay";
import {
  MatchVotingOverlay,
  type MatchVotingOverlayPlayer,
} from "./components/MatchVoting";
import { MatchGamePageLayout } from "./layout/MatchGamePageLayout/MatchGamePageLayout";
import styles from "./match-screen.module.css";

type MatchScreenProps = {
  sessionId: string;
  colyseusUrl: string;
};

export type MatchPlayerJson = {
  id: string;
  nickname: string;
  avatarId: number;
  isHost: boolean;
  isSpy: boolean;
  roleAtLocation: string;
  spyCardUrl: string;
  eliminated: boolean;
  deathReason: "" | "voted" | "killed";
  spyGuessUses: number;
};

export type GameStateJson = {
  phase: string;
  matchEndsAt: number;
  matchPaused: boolean;
  matchSessionId: string;
  locationName: string;
  locationImageKey: string;
  themeText: string;
  modeTheme: boolean;
  modeRole: boolean;
  modeHiddenThreat: boolean;
  players: Record<string, MatchPlayerJson>;
  gameStartedAt: number;
  votingDurationSec: number;
  firstEarlyVoteAfterAt: number;
  earlyVoteCooldownUntil: number;
  earlyVotesUsed: number;
  voteIsFinal: boolean;
  voteStage: string;
  voteEndsAt: number;
  voteTransitionEndsAt: number;
  revoteA: string;
  revoteB: string;
  stubEliminatedId: string;
  earlyVoteAck: Record<string, string>;
  voteBallots: Record<string, string>;
  discussionTimerRemainingMs: number;
  gameEndReason: string;
  matchSplashType: string;
  matchSplashAt: number;
  matchSplashEndsAt: number;
  matchSplashEliminatedId: string;
  matchSplashVotePercent: number;
  matchSplashEliminationGameOver: boolean;
  spyGuessAttemptsUsed: number;
  spyGuessCooldownUntil: number;
  spyGuessVoteEndsAt: number;
  spyGuessVoteStartsAt: number;
  spyGuessIsAutoWin: boolean;
  spyGuessText: string;
  spyGuessSpyId: string;
  spyGuessBallots: Record<string, string>;
  spyKillAttemptsUsed: number;
  spyKillCooldownUntil: number;
  spyDiscussActionsUnlockAt: number;
  initialSpyCount: number;
  voteFinalSpiesRemaining: number;
  historyShareHash: string;
  roomId: string;
  /** Id игроков через `|`, порядок карточек в матче (сервер: лобби + shuffle ведущего). */
  playerDisplayOrder: string;
};

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

function parseMatchPause(settings: unknown): { paused: boolean; remainingSec: number | null } {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { paused: false, remainingSec: null };
  }
  const s = settings as Record<string, unknown>;
  const paused = asBool(s.match_paused);
  const r = s.match_paused_remaining_sec;
  const remainingSec =
    typeof r === "number" && Number.isFinite(r) ? Math.max(0, Math.floor(r)) : null;
  return { paused, remainingSec };
}

function strField(p: Record<string, unknown>, camel: string, snake: string): string {
  const a = p[camel];
  const b = p[snake];
  if (typeof a === "string") return a;
  if (typeof b === "string") return b;
  return "";
}

function ingestStringRecord(val: unknown): Record<string, string> {
  if (!val || typeof val !== "object" || Array.isArray(val)) return {};
  const o = val as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function extractPlayer(p: Record<string, unknown> | null | undefined): MatchPlayerJson | null {
  if (!p || typeof p !== "object") return null;
  if (typeof p.id !== "string" || typeof p.nickname !== "string") return null;
  const avatarRaw = num(p.avatarId ?? p.avatar_id);
  const eliminated = asBool(p.eliminated);
  const dr = strField(p, "deathReason", "death_reason").trim().toLowerCase();
  const deathReason: MatchPlayerJson["deathReason"] =
    eliminated && dr === "killed" ? "killed" : eliminated ? "voted" : "";
  return {
    id: p.id,
    nickname: p.nickname,
    avatarId: avatarRaw >= 1 && avatarRaw <= 16 ? Math.floor(avatarRaw) : 1,
    isHost: asBool(p.isHost ?? p.is_host),
    isSpy: asBool(p.isSpy ?? p.is_spy),
    roleAtLocation: strField(p, "roleAtLocation", "role_at_location"),
    spyCardUrl: strField(p, "spyCardUrl", "spy_card_url"),
    eliminated,
    deathReason,
    spyGuessUses: num(p.spyGuessUses ?? p.spy_guess_uses),
  };
}

function snapshotMatchState(room: Room): GameStateJson | null {
  const s = room.state as unknown;
  if (s === null || s === undefined) return null;

  const players: GameStateJson["players"] = {};

  type LooseState = {
    phase?: string;
    matchEndsAt?: number;
    matchPaused?: boolean;
    matchSessionId?: string;
    locationName?: string;
    locationImageKey?: string;
    themeText?: string;
    modeTheme?: boolean;
    modeRole?: boolean;
    _phase?: string;
    _matchEndsAt?: number;
    _matchSessionId?: string;
    players?: {
      forEach?: (cb: (v: unknown, k: string) => void) => void;
      toJSON?: () => Record<string, unknown>;
      $items?: Map<string, unknown>;
    };
    toJSON?: () => Record<string, unknown>;
  };

  const loose = s as LooseState;

  const ingestPlayerMap = (raw: Record<string, unknown>) => {
    for (const key of Object.keys(raw)) {
      const p = raw[key];
      if (p && typeof p === "object" && p !== null) {
        const row = extractPlayer(p as Record<string, unknown>);
        if (row) players[String(key)] = row;
      }
    }
  };

  if (typeof loose.toJSON === "function") {
    try {
      const j = loose.toJSON();
      const jp = j.players;
      if (jp && typeof jp === "object" && !Array.isArray(jp)) {
        ingestPlayerMap(jp as Record<string, unknown>);
      }
    } catch {
      /* ignore */
    }
  }

  if (Object.keys(players).length === 0) {
    loose.players?.forEach?.((p, key) => {
      const row = extractPlayer(p as Record<string, unknown>);
      if (row) players[String(key)] = row;
    });
  }

  if (Object.keys(players).length === 0 && loose.players?.$items) {
    loose.players.$items.forEach((p, key) => {
      const row = extractPlayer(p as Record<string, unknown>);
      if (row) players[String(key)] = row;
    });
  }

  if (Object.keys(players).length === 0 && loose.players && typeof loose.players.toJSON === "function") {
    try {
      const raw = loose.players.toJSON();
      ingestPlayerMap(raw);
    } catch {
      /* ignore */
    }
  }

  let phase = typeof loose.phase === "string" ? loose.phase : "discussion";
  let matchEndsAt = num(loose.matchEndsAt);
  let matchSessionId = typeof loose.matchSessionId === "string" ? loose.matchSessionId : "";
  let locationName = typeof loose.locationName === "string" ? loose.locationName : "";
  let locationImageKey = typeof loose.locationImageKey === "string" ? loose.locationImageKey : "";
  let themeText = typeof loose.themeText === "string" ? loose.themeText : "";
  let modeTheme = asBool(loose.modeTheme);
  let modeRole = asBool(loose.modeRole);
  let modeHiddenThreat = asBool((loose as { modeHiddenThreat?: unknown }).modeHiddenThreat);
  let matchPaused = asBool(loose.matchPaused);

  let gameStartedAt = 0;
  let votingDurationSec = 60;
  let firstEarlyVoteAfterAt = 0;
  let earlyVoteCooldownUntil = 0;
  let earlyVotesUsed = 0;
  let voteIsFinal = false;
  let voteStage = "idle";
  let voteEndsAt = 0;
  let voteTransitionEndsAt = 0;
  let revoteA = "";
  let revoteB = "";
  let stubEliminatedId = "";
  let earlyVoteAck: Record<string, string> = {};
  let voteBallots: Record<string, string> = {};
  let discussionTimerRemainingMs = 0;
  let gameEndReason = "";
  let matchSplashType = "";
  let matchSplashAt = 0;
  let matchSplashEndsAt = 0;
  let matchSplashEliminatedId = "";
  let matchSplashVotePercent = 0;
  let matchSplashEliminationGameOver = false;
  let spyGuessAttemptsUsed = 0;
  let spyGuessCooldownUntil = 0;
  let spyGuessVoteEndsAt = 0;
  let spyGuessVoteStartsAt = 0;
  let spyGuessIsAutoWin = false;
  let spyGuessText = "";
  let spyGuessSpyId = "";
  let spyGuessBallots: Record<string, string> = {};
  let spyKillAttemptsUsed = 0;
  let spyKillCooldownUntil = 0;
  let spyDiscussActionsUnlockAt = 0;
  let initialSpyCount = 1;
  let voteFinalSpiesRemaining = 0;
  let historyShareHash = "";
  let roomId = "";
  let playerDisplayOrder = "";

  if (!matchEndsAt) matchEndsAt = num(loose._matchEndsAt);
  if (typeof loose._phase === "string" && loose._phase) phase = loose._phase;
  if (!matchSessionId && typeof loose._matchSessionId === "string") matchSessionId = loose._matchSessionId;

  if (typeof loose.toJSON === "function") {
    try {
      const j = loose.toJSON() as Record<string, unknown>;
      if (typeof j.phase === "string") phase = j.phase;
      const me = num(j.matchEndsAt ?? j.match_ends_at);
      if (me > 0) matchEndsAt = me;
      if (typeof j.matchSessionId === "string" && j.matchSessionId) matchSessionId = j.matchSessionId;
      if (typeof j.locationName === "string") locationName = j.locationName;
      else if (typeof j.location_name === "string") locationName = j.location_name;
      if (typeof j.locationImageKey === "string") locationImageKey = j.locationImageKey;
      else if (typeof j.location_image_key === "string") locationImageKey = j.location_image_key;
      if (typeof j.themeText === "string") themeText = j.themeText;
      else if (typeof j.theme_text === "string") themeText = j.theme_text;
      if ("modeTheme" in j) modeTheme = asBool(j.modeTheme);
      else if ("mode_theme" in j) modeTheme = asBool(j.mode_theme);
      if ("modeRole" in j) modeRole = asBool(j.modeRole);
      else if ("mode_role" in j) modeRole = asBool(j.mode_role);
      if ("modeHiddenThreat" in j) modeHiddenThreat = asBool(j.modeHiddenThreat);
      else if ("mode_hidden_threat" in j) modeHiddenThreat = asBool(j.mode_hidden_threat);
      if ("matchPaused" in j) matchPaused = asBool(j.matchPaused);
      else if ("match_paused" in j) matchPaused = asBool(j.match_paused);

      gameStartedAt = num(j.gameStartedAt ?? j.game_started_at);
      votingDurationSec = num(j.votingDurationSec ?? j.voting_duration_sec) || 60;
      firstEarlyVoteAfterAt = num(j.firstEarlyVoteAfterAt ?? j.first_early_vote_after_at);
      earlyVoteCooldownUntil = num(j.earlyVoteCooldownUntil ?? j.early_vote_cooldown_until);
      earlyVotesUsed = num(j.earlyVotesUsed ?? j.early_votes_used);
      if ("voteIsFinal" in j) voteIsFinal = asBool(j.voteIsFinal);
      else if ("vote_is_final" in j) voteIsFinal = asBool(j.vote_is_final);
      if (typeof j.voteStage === "string") voteStage = j.voteStage;
      else if (typeof j.vote_stage === "string") voteStage = j.vote_stage;
      voteEndsAt = num(j.voteEndsAt ?? j.vote_ends_at);
      voteTransitionEndsAt = num(j.voteTransitionEndsAt ?? j.vote_transition_ends_at);
      if (typeof j.revoteA === "string") revoteA = j.revoteA;
      else if (typeof j.revote_a === "string") revoteA = j.revote_a;
      if (typeof j.revoteB === "string") revoteB = j.revoteB;
      else if (typeof j.revote_b === "string") revoteB = j.revote_b;
      if (typeof j.stubEliminatedId === "string") stubEliminatedId = j.stubEliminatedId;
      else if (typeof j.stub_eliminated_id === "string") stubEliminatedId = j.stub_eliminated_id;
      earlyVoteAck = ingestStringRecord(j.earlyVoteAck ?? j.early_vote_ack);
      voteBallots = ingestStringRecord(j.voteBallots ?? j.vote_ballots);
      discussionTimerRemainingMs = num(
        j.discussionTimerRemainingMs ?? j.discussion_timer_remaining_ms,
      );
      if (typeof j.gameEndReason === "string") gameEndReason = j.gameEndReason;
      else if (typeof j.game_end_reason === "string") gameEndReason = j.game_end_reason;

      if (typeof j.matchSplashType === "string") matchSplashType = j.matchSplashType;
      else if (typeof j.match_splash_type === "string") matchSplashType = j.match_splash_type;
      matchSplashAt = num(j.matchSplashAt ?? j.match_splash_at);
      matchSplashEndsAt = num(j.matchSplashEndsAt ?? j.match_splash_ends_at);
      if (typeof j.matchSplashEliminatedId === "string") matchSplashEliminatedId = j.matchSplashEliminatedId;
      else if (typeof j.match_splash_eliminated_id === "string")
        matchSplashEliminatedId = j.match_splash_eliminated_id;
      matchSplashVotePercent = num(j.matchSplashVotePercent ?? j.match_splash_vote_percent);
      if ("matchSplashEliminationGameOver" in j)
        matchSplashEliminationGameOver = asBool(j.matchSplashEliminationGameOver);
      else if ("match_splash_elimination_game_over" in j)
        matchSplashEliminationGameOver = asBool(j.match_splash_elimination_game_over);

      spyGuessAttemptsUsed = num(j.spyGuessAttemptsUsed ?? j.spy_guess_attempts_used);
      spyGuessCooldownUntil = num(j.spyGuessCooldownUntil ?? j.spy_guess_cooldown_until);
      spyGuessVoteEndsAt = num(j.spyGuessVoteEndsAt ?? j.spy_guess_vote_ends_at);
      spyGuessVoteStartsAt = num(j.spyGuessVoteStartsAt ?? j.spy_guess_vote_starts_at);
      if ("spyGuessIsAutoWin" in j) spyGuessIsAutoWin = asBool(j.spyGuessIsAutoWin);
      else if ("spy_guess_is_auto_win" in j) spyGuessIsAutoWin = asBool(j.spy_guess_is_auto_win);
      if (typeof j.spyGuessText === "string") spyGuessText = j.spyGuessText;
      else if (typeof j.spy_guess_text === "string") spyGuessText = j.spy_guess_text;
      if (typeof j.spyGuessSpyId === "string") spyGuessSpyId = j.spyGuessSpyId;
      else if (typeof j.spy_guess_spy_id === "string") spyGuessSpyId = j.spy_guess_spy_id;
      spyGuessBallots = ingestStringRecord(j.spyGuessBallots ?? j.spy_guess_ballots);

      spyKillAttemptsUsed = num(j.spyKillAttemptsUsed ?? j.spy_kill_attempts_used);
      spyKillCooldownUntil = num(j.spyKillCooldownUntil ?? j.spy_kill_cooldown_until);
      spyDiscussActionsUnlockAt = num(
        j.spyDiscussActionsUnlockAt ?? j.spy_discuss_actions_unlock_at,
      );
      initialSpyCount = Math.max(
        1,
        Math.min(3, num(j.initialSpyCount ?? j.initial_spy_count) || 1),
      );
      voteFinalSpiesRemaining = num(j.voteFinalSpiesRemaining ?? j.vote_final_spies_remaining);
      if (typeof j.historyShareHash === "string") historyShareHash = j.historyShareHash;
      else if (typeof j.history_share_hash === "string") historyShareHash = j.history_share_hash;
      if (typeof j.roomId === "string") roomId = j.roomId;
      else if (typeof j.room_id === "string") roomId = j.room_id;
      if (typeof j.playerDisplayOrder === "string") playerDisplayOrder = j.playerDisplayOrder;
      else if (typeof j.player_display_order === "string") playerDisplayOrder = j.player_display_order;
    } catch {
      /* ignore */
    }
  }

  /**
   * Поля spyGuess* + MapSchema бюллетеней: опираться только на `toJSON()` ненадёжно (Colyseus / порядок полей).
   * Берём актуальные значения с корневого Schema — иначе UI голосования не монтируется, а попытка на сервере уже сжигается.
   */
  {
    const raw = s as Record<string, unknown>;
    const pickNum = (key: string, fallback: number) => {
      const v = raw[key];
      return typeof v === "number" && Number.isFinite(v) ? v : fallback;
    };
    const pickStr = (key: string, fallback: string) => {
      const v = raw[key];
      return typeof v === "string" ? v : fallback;
    };
    spyGuessAttemptsUsed = pickNum("spyGuessAttemptsUsed", spyGuessAttemptsUsed);
    spyGuessCooldownUntil = pickNum("spyGuessCooldownUntil", spyGuessCooldownUntil);
    spyGuessVoteEndsAt = pickNum("spyGuessVoteEndsAt", spyGuessVoteEndsAt);
    spyGuessVoteStartsAt = pickNum("spyGuessVoteStartsAt", spyGuessVoteStartsAt);
    const autoWinRaw = raw.spyGuessIsAutoWin;
    spyGuessIsAutoWin =
      autoWinRaw === true || autoWinRaw === 1 || (typeof autoWinRaw === "string" && autoWinRaw === "1");
    spyGuessText = pickStr("spyGuessText", spyGuessText);
    spyGuessSpyId = pickStr("spyGuessSpyId", spyGuessSpyId);

    if ("modeHiddenThreat" in raw) modeHiddenThreat = asBool(raw.modeHiddenThreat);
    spyKillAttemptsUsed = pickNum("spyKillAttemptsUsed", spyKillAttemptsUsed);
    spyKillCooldownUntil = pickNum("spyKillCooldownUntil", spyKillCooldownUntil);
    spyDiscussActionsUnlockAt = pickNum(
      "spyDiscussActionsUnlockAt",
      spyDiscussActionsUnlockAt,
    );
    initialSpyCount = Math.max(
      1,
      Math.min(3, pickNum("initialSpyCount", initialSpyCount) || 1),
    );
    voteFinalSpiesRemaining = pickNum("voteFinalSpiesRemaining", voteFinalSpiesRemaining);
    historyShareHash = pickStr("historyShareHash", historyShareHash);
    roomId = pickStr("roomId", roomId);
    playerDisplayOrder = pickStr("playerDisplayOrder", playerDisplayOrder);

    type SpyGuessBallotsRoot = {
      forEach?: (cb: (v: unknown, k: string) => void) => void;
      toJSON?: () => unknown;
    };
    const ballotsRoot = raw.spyGuessBallots as SpyGuessBallotsRoot | undefined;
    if (ballotsRoot && typeof ballotsRoot === "object") {
      try {
        if (typeof ballotsRoot.toJSON === "function") {
          const o = ballotsRoot.toJSON();
          if (o && typeof o === "object" && !Array.isArray(o)) {
            spyGuessBallots = ingestStringRecord(o as Record<string, unknown>);
          }
        } else if (typeof ballotsRoot.forEach === "function") {
          const rec: Record<string, string> = {};
          ballotsRoot.forEach((v, k) => {
            if (typeof v === "string") rec[k] = v;
          });
          spyGuessBallots = rec;
        }
      } catch {
        /* keep spyGuessBallots from JSON */
      }
    }
  }

  if (phase === "voting" && (voteStage === "idle" || voteStage === "")) {
    voteStage = "collect1";
  }

  return {
    phase,
    matchEndsAt,
    matchPaused,
    matchSessionId,
    locationName,
    locationImageKey,
    themeText,
    modeTheme,
    modeRole,
    modeHiddenThreat,
    players,
    gameStartedAt,
    votingDurationSec,
    firstEarlyVoteAfterAt,
    earlyVoteCooldownUntil,
    earlyVotesUsed,
    voteIsFinal,
    voteStage,
    voteEndsAt,
    voteTransitionEndsAt,
    revoteA,
    revoteB,
    stubEliminatedId,
    earlyVoteAck,
    voteBallots,
    discussionTimerRemainingMs,
    gameEndReason,
    matchSplashType,
    matchSplashAt,
    matchSplashEndsAt,
    matchSplashEliminatedId,
    matchSplashVotePercent,
    matchSplashEliminationGameOver,
    spyGuessAttemptsUsed,
    spyGuessCooldownUntil,
    spyGuessVoteEndsAt,
    spyGuessVoteStartsAt,
    spyGuessIsAutoWin,
    spyGuessText,
    spyGuessSpyId,
    spyGuessBallots,
    spyKillAttemptsUsed,
    spyKillCooldownUntil,
    spyDiscussActionsUnlockAt,
    initialSpyCount,
    voteFinalSpiesRemaining,
    historyShareHash,
    roomId,
    playerDisplayOrder,
  };
}

const DEVICE_PLAYER_KEY = "spyfall_device_player_id";

function getOrCreateDevicePlayerId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(DEVICE_PLAYER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(DEVICE_PLAYER_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function formatEarlyLock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatConnectError(e: unknown): string {
  if (typeof ProgressEvent !== "undefined" && e instanceof ProgressEvent) {
    return e.type === "error"
      ? "WebSocket: сервер недоступен (проверь, что game-server слушает порт Colyseus)"
      : `WebSocket: ${e.type}`;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

const JOIN_ATTEMPTS = 5;
const JOIN_RETRY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readMatchDebug(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("matchDebug") === "1";
}

function parseMatchAssignmentPayload(raw: unknown): MatchAssignmentPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  return {
    themeText: typeof p.themeText === "string" ? p.themeText : "",
    modeTheme: asBool(p.modeTheme),
    modeRole: asBool(p.modeRole),
    roleAtLocation: typeof p.roleAtLocation === "string" ? p.roleAtLocation : "",
  };
}

function getLobbyPlayerId(roomCode: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`player_${roomCode}`) ?? peekStashedRoomPlayer(roomCode);
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function orderMatchPlayersForDisplay(rows: MatchPlayerJson[], orderPipe: string): MatchPlayerJson[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const t = orderPipe.trim();
  if (!t) {
    return [...rows].sort((a, b) => a.nickname.localeCompare(b.nickname, "ru"));
  }
  const ordered: MatchPlayerJson[] = [];
  const seen = new Set<string>();
  for (const id of t.split("|")) {
    if (!id) continue;
    const p = byId.get(id);
    if (p) {
      ordered.push(p);
      seen.add(id);
    }
  }
  for (const r of rows) {
    if (!seen.has(r.id)) ordered.push(r);
  }
  return ordered;
}

function toLobbyPlayers(rows: MatchPlayerJson[], roomId: string): GamePlayer[] {
  return rows.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      avatar_id: Math.min(16, Math.max(1, p.avatarId)) as AvatarId,
      is_host: p.isHost,
      room_id: roomId,
      joined_at: "",
      is_alive: !p.eliminated,
      death_reason: p.eliminated ? (p.deathReason === "killed" ? ("killed" as const) : ("voted" as const)) : null,
      is_spy: p.isSpy,
    }));
}

/**
 * Лоадер держим, пока в Colyseus нет полной картины: таймер матча и все игроки из Supabase.
 * `expectedCount === null` — head-count по `players` ещё не пришёл; `-1` — ошибка запроса, хватает ≥1 в state.
 */
/** Этапы, с которых UI голосования уходит exit-анимацией перед сплэшем изгнания. */
const VOTE_OVERLAY_STAGES_BEFORE_ELIMINATION_SPLASH = new Set([
  "collect1",
  "collect2",
  "intermission_no_vote",
  "intermission_tie",
  "intermission_revote_no_vote",
]);

/** После проигрыша Emergency intro — при F5 в той же фазе голосования анимацию не повторяем. */
const SPY_GUESS_INTRO_DONE_STORAGE_PREFIX = "spyfall_spyguess_intro_done:";

function syncPlayPageMusicForState(json: GameStateJson | null): void {
  if (!json) return;
  const spyGuessMusicActive =
    json.phase === "discussion" &&
    json.spyGuessVoteEndsAt > 0 &&
    !!json.spyGuessSpyId;
  if (spyGuessMusicActive) {
    stopVoteMusic();
    startSpyGuessMusic();
    return;
  }
  stopSpyGuessMusic();

  const { phase, voteStage, matchSplashType } = json;
  const votingUi = phase === "voting" && voteStage !== "elimination_splash";
  if (votingUi) {
    const round =
      voteStage === "collect2" || voteStage === "intermission_revote_no_vote"
        ? "revote"
        : voteStage === "collect1" ||
            voteStage === "intermission_no_vote" ||
            voteStage === "intermission_tie"
          ? "first"
          : null;
    if (round) startVoteMusic(round);
  } else {
    stopVoteMusic();
    const eliminationSplash =
      phase === "voting" && voteStage === "elimination_splash";
    const endedWithSplash =
      phase === "ended" &&
      Boolean(matchSplashType) &&
      MATCH_COLYSEUS_SPLASH_TYPES.has(matchSplashType);
    const spyKillSplash = phase === "discussion" && matchSplashType === "spy_kill";
    if (phase === "discussion" || eliminationSplash || endedWithSplash || spyKillSplash) {
      startGameMusic();
    }
  }
}

function isMatchRouteLoaderReady(
  stateJson: GameStateJson | null,
  expectedCount: number | null,
): boolean {
  if (!stateJson) return false;
  const inState = Object.keys(stateJson.players).length;
  if (inState === 0) return false;
  if (stateJson.matchEndsAt <= 0) return false;
  if (expectedCount === null) return false;
  if (expectedCount < 0) return inState >= 1;
  return inState >= expectedCount;
}

export function MatchScreen({ sessionId, colyseusUrl }: MatchScreenProps) {
  const router = useRouter();
  const stopRouteLoader = useRouteLoaderStore((s) => s.stop);
  const startRouteLoader = useRouteLoaderStore((s) => s.start);
  const { setUiReady } = useMatchPlayUiReady();

  /* Полный перезагрузка /play (F5): лоадер не включался — только при client-nav из лобби был start(). */
  useLayoutEffect(() => {
    startRouteLoader();
  }, [startRouteLoader]);

  const [status, setStatus] = useState<"idle" | "connecting" | "ok" | "error">(
    "idle",
  );
  const [connectErrorDetail, setConnectErrorDetail] = useState<string | null>(null);
  const [pong, setPong] = useState<string | null>(null);
  const [stateJson, setStateJson] = useState<GameStateJson | null>(null);
  /** Актуальное состояние матча для realtime без устаревшего замыкания (historyShareHash при status→waiting). */
  const stateJsonRef = useRef<GameStateJson | null>(null);
  const [clockSkewMs, setClockSkewMs] = useState(0);
  /** Только чтобы форсировать ре-рендер после exit голосования (ref сам по себе не триггерит paint). */
  const [, bumpEliminationSplashAfterVoteExit] = useReducer((n: number) => n + 1, 0);
  const [, bumpUi] = useReducer((n: number) => n + 1, 0);
  const [playBundle, setPlayBundle] = useState<{
    dbRoomId: string;
    hostId: string;
    colyseusRoomId?: string;
    /** Режимы «тема/роли» из Supabase — надёжнее, чем булевы поля Colyseus в сети. */
    lobbySettings: Settings;
    /** Сырой JSON из `rooms.settings` (для dev-сравнения с нормализацией). */
    rawRoomSettings: Record<string, unknown>;
  } | null>(null);
  const [endMatchBusy, setEndMatchBusy] = useState(false);
  const [endMatchError, setEndMatchError] = useState<string | null>(null);
  const [matchDebugDump, setMatchDebugDump] = useState<string | null>(null);
  const [joinNickname, setJoinNickname] = useState<string | null>(null);
  const [joinIdentityReady, setJoinIdentityReady] = useState(false);
  /** Дублирует тему/роль с сервера отдельным сообщением (обход проблем декода Schema). */
  const [assignmentPatch, setAssignmentPatch] = useState<MatchAssignmentPayload | null>(null);

  useEffect(() => {
    stateJsonRef.current = stateJson;
  }, [stateJson]);
  type LocationDevState =
    | { status: "idle" }
    | { status: "loading" }
    | {
        status: "ok";
        row: Record<string, unknown>;
        matchBy: "image_key" | "name";
      }
    | { status: "error"; message: string };
  const [locationDev, setLocationDev] = useState<LocationDevState>({ status: "idle" });
  /** Пауза матча из `rooms.settings` (единый рычаг для UI и будущих блоков). */
  const [matchPauseFromRoom, setMatchPauseFromRoom] = useState<{
    paused: boolean;
    remainingSec: number | null;
  }>({ paused: false, remainingSec: null });
  const [pauseBusy, setPauseBusy] = useState(false);
  /** Ожидаемое число строк в `players` для комнаты (сверка с Colyseus). */
  const [expectedPlayerCount, setExpectedPlayerCount] = useState<number | null>(null);
  const colyseusRoomRef = useRef<Room | null>(null);
  const prevVoteStageRef = useRef<string | undefined>(undefined);
  const suppressSplashUntilVoteExitRef = useRef(false);
  const prevSpyGuessSessionKeyRef = useRef<string | null>(null);
  /** false с момента входа в elimination_splash из фазы голосования до onExitComplete оверлея — без setState, синхронно в рендере. */
  const eliminationSplashAllowedAfterVoteExitRef = useRef(true);
  const [colyseusRoom, setColyseusRoom] = useState<Room | null>(null);
  const [effectiveColyseusUrl, setEffectiveColyseusUrl] = useState(colyseusUrl);

  useLayoutEffect(() => {
    setEffectiveColyseusUrl(resolveColyseusUrlForBrowser(colyseusUrl));
  }, [colyseusUrl]);

  const lobbyPlayerId = getLobbyPlayerId(sessionId);
  const effectivePlayerId = lobbyPlayerId ?? getOrCreateDevicePlayerId();
  const dbRoomId = playBundle?.dbRoomId ?? "";
  const isMatchHost = !!playBundle && !!lobbyPlayerId && lobbyPlayerId === playBundle.hostId;

  const reactions = useReactions();
  const [matchOnlinePlayers, setMatchOnlinePlayers] = useState<Set<string>>(() => new Set());
  const { sendReaction } = useMatchReactionsChannel({
    roomId: playBundle?.dbRoomId ?? null,
    playerId: lobbyPlayerId,
    onReaction: (payload) => reactions?.addReaction(payload),
    setOnlinePlayers: setMatchOnlinePlayers,
  });

  const sendReactionRef = useRef(sendReaction);
  sendReactionRef.current = sendReaction;

  const sendReactionWithSelf = useCallback(
    (reactionId: number) => {
      if (!lobbyPlayerId) return;
      reactions?.addReaction({ playerId: lobbyPlayerId, reactionId });
      sendReactionRef.current(reactionId);
    },
    [lobbyPlayerId, reactions],
  );

  useEffect(() => {
    reactions?.registerSendReaction(sendReactionWithSelf);
    return () => reactions?.registerSendReaction(() => {});
  }, [reactions, sendReactionWithSelf]);

  useEffect(() => {
    const id = window.setInterval(() => {
      bumpUi();
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    syncPlayPageMusicForState(stateJson);
  }, [
    stateJson?.phase,
    stateJson?.voteStage,
    stateJson?.matchSplashType,
    stateJson?.spyGuessVoteEndsAt,
    stateJson?.spyGuessSpyId,
  ]);

  const stateJsonMusicRef = useRef(stateJson);
  stateJsonMusicRef.current = stateJson;
  useEffect(() => {
    setMatchMusicBootstrapHandler(() => {
      syncPlayPageMusicForState(stateJsonMusicRef.current);
    });
    return () => setMatchMusicBootstrapHandler(null);
  }, []);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        syncPlayPageMusicForState(stateJsonMusicRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: room, error } = await supabase
        .from("rooms")
        .select("id, host_id, status, settings")
        .eq("code", sessionId)
        .single();
      if (cancelled) return;
      if (error || !room) {
        setConnectErrorDetail("Комната не найдена в Supabase");
        setStatus("error");
        setPlayBundle(null);
        return;
      }
      if (room.status !== "playing") {
        router.replace(`/lobby/${sessionId}`);
        return;
      }
      const raw =
        room.settings && typeof room.settings === "object" && !Array.isArray(room.settings)
          ? (room.settings as Record<string, unknown>)
          : {};
      const colyseusRoomId =
        typeof raw.colyseus_room_id === "string" && raw.colyseus_room_id.length > 0
          ? raw.colyseus_room_id
          : undefined;
      setPlayBundle({
        dbRoomId: room.id,
        hostId: room.host_id,
        colyseusRoomId,
        lobbySettings: normalizeRoomSettings(room.settings),
        rawRoomSettings: { ...raw },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  useEffect(() => {
    if (!playBundle?.dbRoomId) {
      setExpectedPlayerCount(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { count, error } = await supabase
        .from("players")
        .select("*", { count: "exact", head: true })
        .eq("room_id", playBundle.dbRoomId);
      if (cancelled) return;
      if (error != null) {
        setExpectedPlayerCount(-1);
        return;
      }
      setExpectedPlayerCount(typeof count === "number" ? count : -1);
    })();
    return () => {
      cancelled = true;
    };
  }, [playBundle?.dbRoomId]);

  useEffect(() => {
    if (!playBundle?.rawRoomSettings) {
      setMatchPauseFromRoom({ paused: false, remainingSec: null });
      return;
    }
    setMatchPauseFromRoom(parseMatchPause(playBundle.rawRoomSettings));
  }, [playBundle?.dbRoomId, playBundle?.rawRoomSettings]);

  useEffect(() => {
    if (!playBundle?.dbRoomId) {
      setJoinNickname(null);
      setJoinIdentityReady(false);
      return;
    }
    if (!lobbyPlayerId) {
      setJoinNickname(null);
      setJoinIdentityReady(false);
      return;
    }
    let cancelled = false;
    setJoinIdentityReady(false);
    void (async () => {
      const { data } = await supabase
        .from("players")
        .select("nickname")
        .eq("room_id", playBundle.dbRoomId)
        .eq("id", lobbyPlayerId)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        try {
          window.localStorage.removeItem(`player_${sessionId}`);
        } catch {
          /* */
        }
        clearStashedRoomPlayer(sessionId);
        router.replace(`/invite/${sessionId}`);
        setJoinNickname(null);
        setJoinIdentityReady(false);
        return;
      }
      const n = data?.nickname && typeof data.nickname === "string" ? data.nickname.trim() : "";
      setJoinNickname(n ? n.slice(0, 48) : null);
      setJoinIdentityReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [playBundle?.dbRoomId, lobbyPlayerId, sessionId, router]);

  /** Нет сохранённого id игрока для этой комнаты — /play недоступен, только вход по приглашению. */
  useEffect(() => {
    if (!playBundle?.dbRoomId) return;
    if (lobbyPlayerId) return;
    router.replace(`/invite/${sessionId}`);
  }, [playBundle?.dbRoomId, lobbyPlayerId, sessionId, router]);

  useEffect(() => {
    if (!dbRoomId) return;
    const channel = supabase
      .channel(`match-room-status-${dbRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${dbRoomId}`,
        },
        (payload) => {
          const next = payload.new as { status?: string; settings?: unknown };
          if (next.settings != null) {
            setMatchPauseFromRoom(parseMatchPause(next.settings));
          }
          if (next.status === "waiting") {
            router.replace(`/lobby/${sessionId}`);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dbRoomId, sessionId, router]);

  /** Подстраховка к Realtime: редкий пропуск UPDATE при завершении матча (status → waiting). */
  useEffect(() => {
    if (!dbRoomId) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      void (async () => {
        const { data: room, error } = await supabase
          .from("rooms")
          .select("status, settings")
          .eq("code", sessionId)
          .maybeSingle();
        if (cancelled || error || !room) return;
        if (room.status === "waiting") {
          router.replace(`/lobby/${sessionId}`);
          return;
        }
        if (room.settings != null) {
          setMatchPauseFromRoom(parseMatchPause(room.settings));
        }
      })();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [dbRoomId, sessionId, router]);

  useEffect(() => {
    if (!readMatchDebug()) {
      setLocationDev({ status: "idle" });
      return;
    }
    const key = stateJson?.locationImageKey?.trim() ?? "";
    const name = stateJson?.locationName?.trim() ?? "";
    if (!key && !name) {
      setLocationDev({ status: "idle" });
      return;
    }
    let cancelled = false;
    setLocationDev({ status: "loading" });
    void (async () => {
      const pick = async (by: "image_key" | "name", value: string) => {
        const col = by === "image_key" ? "image_key" : "name";
        return supabase.from("locations").select("id, name, themes, roles, image_key").eq(col, value).maybeSingle();
      };
      if (key) {
        const { data, error } = await pick("image_key", key);
        if (cancelled) return;
        if (error) {
          setLocationDev({ status: "error", message: error.message });
          return;
        }
        if (data) {
          setLocationDev({ status: "ok", row: data as Record<string, unknown>, matchBy: "image_key" });
          return;
        }
      }
      if (name) {
        const { data, error } = await pick("name", name);
        if (cancelled) return;
        if (error) {
          setLocationDev({ status: "error", message: error.message });
          return;
        }
        if (data) {
          setLocationDev({ status: "ok", row: data as Record<string, unknown>, matchBy: "name" });
          return;
        }
      }
      setLocationDev({
        status: "error",
        message:
          "Строка в `locations` не найдена по полям из Colyseus, либо RLS не пускает чтение с клиента.",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [stateJson?.locationImageKey, stateJson?.locationName]);

  const endMatch = useCallback(async () => {
    const hostId = lobbyPlayerId;
    if (!dbRoomId || !hostId) return;
    setEndMatchError(null);
    setEndMatchBusy(true);
    try {
      const res = await fetch("/api/game/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: dbRoomId, hostId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setEndMatchError(data.error ?? "Не удалось завершить матч");
        return;
      }
      router.replace(`/lobby/${sessionId}`);
    } catch {
      setEndMatchError("Сеть или сервер недоступны");
    } finally {
      setEndMatchBusy(false);
    }
  }, [dbRoomId, lobbyPlayerId, router, sessionId]);

  useEffect(() => {
    if (!playBundle || !joinIdentityReady || !lobbyPlayerId) return;

    let disposed = false;
    const client = new Client(effectiveColyseusUrl);
    let room: Room | undefined;

    const run = async () => {
      setAssignmentPatch(null);
      setStatus("connecting");
      setConnectErrorDetail(null);
      const playerId = effectivePlayerId;
      const nickname = joinNickname?.trim().slice(0, 48) || `Игрок ${playerId.slice(0, 8)}`;
      const joinPayload = {
        matchSessionId: sessionId,
        playerId,
        nickname,
      };

      const reservedId = playBundle.colyseusRoomId;
      if (readMatchDebug()) {
        console.warn("[SpyfallMatch] join path", reservedId ? `joinById(${reservedId})` : "joinOrCreate (fallback)");
      }
      if (!reservedId) {
        console.warn(
          "[SpyfallMatch] В settings нет colyseus_room_id — используем joinOrCreate (возможна гонка двух комнат). Начни матч через «Начать игру» после обновления.",
        );
      }

      let lastErr: unknown;
      for (let attempt = 0; attempt < JOIN_ATTEMPTS; attempt++) {
        if (disposed) return;
        try {
          room = reservedId
            ? await client.joinById(reservedId, joinPayload, GameState)
            : await client.joinOrCreate(COLYSEUS_ROOM_NAME, joinPayload, GameState);
          break;
        } catch (e) {
          lastErr = e;
          if (attempt < JOIN_ATTEMPTS - 1) {
            await sleep(JOIN_RETRY_MS);
          }
        }
      }

      try {
        if (!room) {
          throw lastErr ?? new Error("Colyseus join failed");
        }
        if (disposed) {
          await room.leave();
          return;
        }
        colyseusRoomRef.current = room;
        setColyseusRoom(room);
        setStatus("ok");
        const syncFromRoom = () => {
          if (!room) return;
          const snap = snapshotMatchState(room);
          if (snap) setStateJson(snap);

          if (readMatchDebug()) {
            const raw = room.state as Record<string, unknown> & {
              constructor?: { name?: string };
              toJSON?: () => unknown;
            };
            const pl = raw.players as { size?: number } | undefined;
            let rootJson: unknown = null;
            try {
              rootJson = typeof raw.toJSON === "function" ? raw.toJSON() : null;
            } catch (e) {
              rootJson = { toJSON_error: String(e) };
            }
            const info = {
              colyseusUrl: effectiveColyseusUrl,
              roomName: COLYSEUS_ROOM_NAME,
              roomId: room.roomId,
              joinPayloadMatchSessionId: sessionId,
              stateConstructor: raw?.constructor?.name,
              playersMapSize: typeof pl?.size === "number" ? pl.size : undefined,
              snap,
              rootToJSON: rootJson,
            };
            const line = JSON.stringify(info, null, 2);
            console.warn("[SpyfallMatch] sync", info);
            setMatchDebugDump(line.length > 12000 ? `${line.slice(0, 12000)}\n… [обрезано]` : line);
          }
        };

        const playersCol = (
          room.state as { players?: { onAdd?: (cb: () => void) => void; onRemove?: (cb: () => void) => void } }
        ).players;
        playersCol?.onAdd?.(() => syncFromRoom());
        playersCol?.onRemove?.(() => syncFromRoom());

        room.onStateChange(() => {
          syncFromRoom();
        });

        room.onMessage(WS_SERVER_MESSAGE.matchAssignment, (raw: unknown) => {
          const parsed = parseMatchAssignmentPayload(raw);
          if (parsed) setAssignmentPatch(parsed);
        });

        syncFromRoom();
        queueMicrotask(() => syncFromRoom());
        room.onMessage("pong", (payload: { t?: number; serverTime?: number }) => {
          if (typeof payload.serverTime === "number") {
            setClockSkewMs(payload.serverTime - Date.now());
          }
          setPong(JSON.stringify(payload));
        });
        room.send(WS_CLIENT_MESSAGE.ping, { t: Date.now() });
      } catch (e) {
        if (!disposed) {
          setConnectErrorDetail(formatConnectError(e));
          setStatus("error");
        }
      }
    };

    void run();

    return () => {
      disposed = true;
      colyseusRoomRef.current = null;
      setColyseusRoom(null);
      setAssignmentPatch(null);
      void room?.leave();
    };
  }, [
    effectiveColyseusUrl,
    sessionId,
    playBundle,
    effectivePlayerId,
    joinNickname,
    joinIdentityReady,
    lobbyPlayerId,
  ]);

  /* Глобальный лоадер + показ игрового столбца: до полной синхры. Ошибка — показываем стол (DebugPanel и т.д.). */
  useEffect(() => {
    if (status === "error") {
      setUiReady(true);
      stopRouteLoader();
      return;
    }
    if (status !== "ok" || !isMatchRouteLoaderReady(stateJson, expectedPlayerCount)) {
      return;
    }
    let cancelled = false;
    let raf2: number | null = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) {
          setUiReady(true);
          stopRouteLoader();
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      if (raf2 != null) cancelAnimationFrame(raf2);
    };
  }, [status, stateJson, expectedPlayerCount, stopRouteLoader, setUiReady]);

  useEffect(() => {
    if (!lobbyPlayerId) return;
    const t = window.setTimeout(() => {
      setUiReady(true);
      stopRouteLoader();
    }, 30000);
    return () => clearTimeout(t);
  }, [sessionId, lobbyPlayerId, stopRouteLoader, setUiReady]);

  const now = Date.now() + clockSkewMs;
  /** Пока идёт угадайка шпиона — глобальный таймер как при голосовании: остаток из `discussionTimerRemainingMs`. */
  const spyGuessFreezesDiscussionClock =
    stateJson?.phase === "discussion" &&
    stateJson.matchEndsAt > 0 &&
    (stateJson.spyGuessVoteEndsAt > 0 ||
      (stateJson.matchSplashType === "spy_kill" && stateJson.matchSplashEndsAt > 0));
  const discussionRemainingMs =
    stateJson?.phase === "discussion" && stateJson.matchEndsAt > 0
      ? spyGuessFreezesDiscussionClock
        ? Math.max(0, stateJson.discussionTimerRemainingMs)
        : Math.max(0, stateJson.matchEndsAt - now)
      : 0;
  const remainingSec = Math.ceil(discussionRemainingMs / 1000);

  const pauseMatch = useCallback(async () => {
    const hostId = lobbyPlayerId;
    if (!dbRoomId || !hostId) return;
    const sec = Math.max(0, Math.ceil(discussionRemainingMs / 1000));
    setPauseBusy(true);
    try {
      colyseusRoomRef.current?.send(WS_CLIENT_MESSAGE.matchPause, {});
      const res = await fetch("/api/game/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: dbRoomId, hostId, remainingSec: sec }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        console.warn(data.error ?? "Не удалось поставить паузу");
      }
    } finally {
      setPauseBusy(false);
    }
  }, [dbRoomId, lobbyPlayerId, discussionRemainingMs]);

  const resumeMatch = useCallback(async () => {
    const hostId = lobbyPlayerId;
    if (!dbRoomId || !hostId) return;
    setPauseBusy(true);
    try {
      colyseusRoomRef.current?.send(WS_CLIENT_MESSAGE.matchResume, {});
      const res = await fetch("/api/game/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: dbRoomId, hostId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        console.warn(data.error ?? "Не удалось снять паузу");
      }
    } finally {
      setPauseBusy(false);
    }
  }, [dbRoomId, lobbyPlayerId]);

  const shufflePlayerOrder = useCallback(() => {
    colyseusRoomRef.current?.send(WS_CLIENT_MESSAGE.hostShufflePlayerOrder, {});
  }, []);

  const playerRows = stateJson ? Object.values(stateJson.players) : [];
  const listPlayers =
    stateJson && dbRoomId
      ? toLobbyPlayers(
          orderMatchPlayersForDisplay(playerRows, stateJson.playerDisplayOrder ?? ""),
          dbRoomId,
        )
      : [];
  /** Realtime presence (`useMatchReactionsChannel`), как в лобби — не «все из Colyseus = онлайн». */
  const onlineIds = matchOnlinePlayers;
  const me = stateJson?.players[effectivePlayerId] ?? null;
  const isMobile = useMediaQuery("(max-width: 1270px)");

  const lobbyModes = playBundle?.lobbySettings;
  const themeSnapshot = lobbyModes?.match_theme_snapshot?.trim() ?? "";
  /** Режимы включены где угодно из лобби / Colyseus / WS — чтобы подпись «выключено» не путать с багом, когда флаги расходятся. */
  const themeModeOn =
    lobbyModes?.mode_theme === true ||
    asBool(stateJson?.modeTheme) ||
    asBool(assignmentPatch?.modeTheme);
  const roleModeOn =
    lobbyModes?.mode_roles === true ||
    (stateJson != null && asBool(stateJson.modeRole)) ||
    asBool(assignmentPatch?.modeRole);

  const themeForCard =
    themeModeOn
      ? stateJson?.themeText?.trim() ||
        assignmentPatch?.themeText?.trim() ||
        themeSnapshot ||
        ""
      : "";
  const roleForCard =
    roleModeOn ? me?.roleAtLocation?.trim() || assignmentPatch?.roleAtLocation?.trim() || "" : "";
  const locationForCard = me != null && !me.isSpy ? (stateJson?.locationName ?? "").trim() : "";

  const isDiscussion = stateJson?.phase === "discussion";
  const isVotingPhase = stateJson?.phase === "voting";
  const isEndedPhase = stateJson?.phase === "ended";
  const votingFrozenSec =
    isVotingPhase && stateJson
      ? Math.max(0, Math.ceil(stateJson.discussionTimerRemainingMs / 1000))
      : 0;
  const timerExpired =
    isDiscussion &&
    stateJson != null &&
    stateJson.matchEndsAt > 0 &&
    !spyGuessFreezesDiscussionClock &&
    remainingSec <= 0;
  const clockDisplay = isEndedPhase
    ? "--:--"
    : isVotingPhase
      ? formatClock(votingFrozenSec)
      : isDiscussion
        ? formatClock(remainingSec)
        : timerExpired
          ? "00:00"
          : "--:--";
  const timerTone: "normal" | "warn" | "danger" = isEndedPhase
    ? "normal"
    : isVotingPhase
      ? votingFrozenSec <= 60
        ? "danger"
        : votingFrozenSec <= 180
          ? "warn"
          : "normal"
      : timerExpired
        ? "danger"
        : isDiscussion && remainingSec <= 60
          ? "danger"
          : isDiscussion && remainingSec <= 180
            ? "warn"
            : "normal";

  const alivePlayerCount = playerRows.filter((p) => !p.eliminated).length;
  const earlyMajority = Math.max(1, Math.floor(Math.max(1, alivePlayerCount) / 2) + 1);
  const earlyAckCount = stateJson
    ? Object.keys(stateJson.earlyVoteAck).filter((id) => !stateJson.players[id]?.eliminated).length
    : 0;
  const earlyUnlockAt =
    stateJson != null ? Math.max(stateJson.firstEarlyVoteAfterAt, stateJson.earlyVoteCooldownUntil) : 0;
  const earlyLockRemainSec =
    isDiscussion && stateJson != null && earlyUnlockAt > now
      ? Math.max(0, Math.ceil((earlyUnlockAt - now) / 1000))
      : 0;
  const earlyLimitReached = (stateJson?.earlyVotesUsed ?? 0) >= 2;
  const meEliminated = me?.eliminated === true;
  const earlyShowPrimary =
    isDiscussion && !earlyLimitReached && earlyLockRemainSec <= 0 && !meEliminated;
  const earlySecondaryLabel = isEndedPhase
    ? "ИГРА ЗАВЕРШЕНА"
    : !isDiscussion
      ? "ИДЁТ ГОЛОСОВАНИЕ"
      : earlyLimitReached
        ? "ЛИМИТ ДОСРОЧНЫХ (2/2)"
        : earlyLockRemainSec > 0
          ? `ДОСТУПНО ЧЕРЕЗ ${formatEarlyLock(earlyLockRemainSec)}`
          : "ГОЛОСОВАНИЕ НЕДОСТУПНО";

  const [spyGuessModalOpen, setSpyGuessModalOpen] = useState(false);
  const [spyKillModalOpen, setSpyKillModalOpen] = useState(false);
  /** Exit-fall Emergency завершён — снимаем intro-слой. */
  const [spyGuessCinematicDone, setSpyGuessCinematicDone] = useState(false);
  /** Старт exit-fall — в этот же момент монтируем Splash под Emergency. */
  const [spyGuessExitFallStarted, setSpyGuessExitFallStarted] = useState(false);

  const spyGuessSessionKey = useMemo(() => {
    if (!stateJson || !isDiscussion) return null;
    if (stateJson.spyGuessVoteEndsAt <= 0 || !stateJson.spyGuessSpyId) return null;
    return `${stateJson.spyGuessSpyId}:${stateJson.spyGuessVoteStartsAt}:${stateJson.spyGuessText}`;
  }, [stateJson, isDiscussion]);

  /** Синхронно с первого кадра (до useEffect): F5 — не монтировать Emergency, не играть VFX. */
  const spyGuessIntroDoneInStorage = useMemo(() => {
    if (!spyGuessSessionKey || typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(SPY_GUESS_INTRO_DONE_STORAGE_PREFIX + spyGuessSessionKey) === "1";
    } catch {
      return false;
    }
  }, [spyGuessSessionKey]);

  useEffect(() => {
    if (!spyGuessIntroDoneInStorage) return;
    syncPlayPageMusicForState(stateJson);
  }, [spyGuessIntroDoneInStorage, stateJson]);

  const spyGuessLegacyNoCinematic =
    !!stateJson &&
    isDiscussion &&
    stateJson.spyGuessVoteEndsAt > 0 &&
    !!stateJson.spyGuessSpyId &&
    stateJson.spyGuessVoteStartsAt <= 0;

  useEffect(() => {
    if (!spyGuessSessionKey) {
      const prevKey = prevSpyGuessSessionKeyRef.current;
      if (prevKey && typeof window !== "undefined") {
        try {
          sessionStorage.removeItem(SPY_GUESS_INTRO_DONE_STORAGE_PREFIX + prevKey);
        } catch {
          /* private mode */
        }
      }
      prevSpyGuessSessionKeyRef.current = null;
      setSpyGuessCinematicDone(false);
      setSpyGuessExitFallStarted(false);
      return;
    }
    if (prevSpyGuessSessionKeyRef.current !== spyGuessSessionKey) {
      const oldKey = prevSpyGuessSessionKeyRef.current;
      if (oldKey && typeof window !== "undefined") {
        try {
          sessionStorage.removeItem(SPY_GUESS_INTRO_DONE_STORAGE_PREFIX + oldKey);
        } catch {
          /* private mode */
        }
      }
      prevSpyGuessSessionKeyRef.current = spyGuessSessionKey;
      setSpyGuessCinematicDone(false);
      setSpyGuessExitFallStarted(false);
    }
  }, [spyGuessSessionKey]);

  useEffect(() => {
    if (spyGuessLegacyNoCinematic) {
      setSpyGuessCinematicDone(true);
      setSpyGuessExitFallStarted(true);
    }
  }, [spyGuessLegacyNoCinematic]);

  const spyGuessVoteGatePassed =
    !!stateJson &&
    isDiscussion &&
    stateJson.spyGuessVoteEndsAt > 0 &&
    (spyGuessLegacyNoCinematic || stateJson.spyGuessVoteStartsAt <= now);

  /** Сколько целых секунд до приёма голосов на сервере (`spyGuessVoteStartsAt`). */
  const spyGuessVoteOpensRemainSec =
    stateJson &&
    isDiscussion &&
    stateJson.spyGuessVoteEndsAt > 0 &&
    stateJson.spyGuessVoteStartsAt > 0 &&
    now < stateJson.spyGuessVoteStartsAt
      ? Math.max(0, Math.ceil((stateJson.spyGuessVoteStartsAt - now) / 1000))
      : 0;

  const showSpyGuessCinematic =
    !!stateJson &&
    isDiscussion &&
    stateJson.spyGuessVoteEndsAt > 0 &&
    !!stateJson.spyGuessSpyId &&
    !spyGuessLegacyNoCinematic &&
    !spyGuessCinematicDone &&
    !spyGuessIntroDoneInStorage;

  const showSpyGuessVoteOverlay =
    !!stateJson &&
    isDiscussion &&
    stateJson.spyGuessVoteEndsAt > 0 &&
    !!stateJson.spyGuessSpyId &&
    (spyGuessLegacyNoCinematic || spyGuessExitFallStarted || spyGuessIntroDoneInStorage);

  /** Сколько шпионов в ростере (в т.ч. выбывшие) — надёжнее `initialSpyCount` из JSON при рассинхроне версий. */
  const rosterSpyCountForGuessUi = playerRows.filter((p) => p.isSpy).length;
  /** Стартовый общий гейт (в т.ч. 2+ шпионов) + в соло перезарядка между 1-й и 2-й попыткой. */
  const spyGuessCooldownRemainSec =
    stateJson != null &&
    isDiscussion &&
    stateJson.spyGuessCooldownUntil > now &&
    (rosterSpyCountForGuessUi >= 2 || stateJson.spyGuessAttemptsUsed < 2)
      ? Math.max(0, Math.ceil((stateJson.spyGuessCooldownUntil - now) / 1000))
      : 0;

  const spyKillCooldownRemainSec =
    stateJson != null &&
    isDiscussion &&
    stateJson.modeHiddenThreat &&
    stateJson.spyKillCooldownUntil > now &&
    stateJson.spyKillAttemptsUsed < 2
      ? Math.max(0, Math.ceil((stateJson.spyKillCooldownUntil - now) / 1000))
      : 0;

  const spyBlockLive = useMemo(() => {
    if (!stateJson || !isDiscussion || me?.isSpy !== true || isEndedPhase) return null;
    if (meEliminated) {
      return {
        modeHiddenThreat: false,
        actionStatusLine: "ВЫ ВЫБЫЛИ",
        buttonsMuted: true,
        guessDisabled: true,
        guessUsed: false,
        onGuessClick: undefined,
        subtitle: "Действия недоступны",
        killDisabled: true,
        killUsed: true,
        onKillClick: undefined,
      };
    }
    const attempts = stateJson.spyGuessAttemptsUsed;
    const kills = stateJson.spyKillAttemptsUsed;
    const modeHiddenThreat = stateJson.modeHiddenThreat === true;
    const chaosMode = lobbyModes?.mode_spy_chaos === true;
    const voteOpen = stateJson.spyGuessVoteEndsAt > 0;
    const killSplash = stateJson.matchSplashType === "spy_kill";
    const cooldown = spyGuessCooldownRemainSec > 0;
    const lowPlayers = alivePlayerCount < 4;
    const combinedExhausted = modeHiddenThreat && attempts + kills >= 2;
    const initialSpies = Math.min(
      3,
      Math.max(1, Math.max(stateJson.initialSpyCount, rosterSpyCountForGuessUi)),
    );
    const multiSpyTeam = initialSpies >= 2;
    const mySpyUses = me?.spyGuessUses ?? 0;
    const teamGuessUses = playerRows
      .filter((p) => p.isSpy)
      .reduce((acc, p) => acc + (p.spyGuessUses ?? 0), 0);

    const personalActionCap = chaosMode || multiSpyTeam ? 1 : 2;
    const personalActionsUsed = modeHiddenThreat
      ? attempts + kills
      : multiSpyTeam || chaosMode
        ? mySpyUses
        : attempts;
    const guessMaxed = personalActionsUsed >= personalActionCap || combinedExhausted;
    const roundGateActive =
      modeHiddenThreat && now < stateJson.spyDiscussActionsUnlockAt && attempts + kills < 2;

    const guessDisabled =
      status !== "ok" ||
      voteOpen ||
      cooldown ||
      guessMaxed ||
      (modeHiddenThreat && combinedExhausted && !voteOpen) ||
      (modeHiddenThreat && lowPlayers) ||
      (modeHiddenThreat && killSplash) ||
      roundGateActive;

    const killCooldownActive = modeHiddenThreat && spyKillCooldownRemainSec > 0;
    const killDisabled =
      !modeHiddenThreat ||
      status !== "ok" ||
      voteOpen ||
      killSplash ||
      lowPlayers ||
      kills >= 2 ||
      combinedExhausted ||
      killCooldownActive ||
      roundGateActive;

    const canGuess = !guessMaxed && !guessDisabled;
    const killUsedVisual = kills >= 2 || combinedExhausted;
    const canKill = modeHiddenThreat && !killUsedVisual && !killDisabled;

    const unlockCandidates: number[] = [];
    if (modeHiddenThreat && attempts + kills < 2) {
      const u = stateJson.spyDiscussActionsUnlockAt;
      if (u > now) unlockCandidates.push(u);
    }
    if (spyGuessCooldownRemainSec > 0) {
      unlockCandidates.push(stateJson.spyGuessCooldownUntil);
    }
    if (stateJson.spyKillCooldownUntil > now && kills < 2 && attempts + kills < 2) {
      unlockCandidates.push(stateJson.spyKillCooldownUntil);
    }
    const nextUnlockAt = unlockCandidates.length > 0 ? Math.min(...unlockCandidates) : 0;
    const nextUnlockRemainSec =
      nextUnlockAt > now ? Math.max(0, Math.ceil((nextUnlockAt - now) / 1000)) : 0;

    const exhaustedHidden = modeHiddenThreat && attempts + kills >= 2;
    const exhaustedPersonal = personalActionsUsed >= personalActionCap;
    let actionStatusLine = `Действия: ${Math.min(personalActionsUsed, personalActionCap)}/${personalActionCap}`;
    if (killSplash) {
      actionStatusLine = "";
    } else if (voteOpen) {
      actionStatusLine = "Идёт голосование по попытке угадать.";
    } else if (modeHiddenThreat && lowPlayers && attempts + kills >= 1) {
      actionStatusLine = "Все действия использованы.";
    } else if (modeHiddenThreat && lowPlayers) {
      actionStatusLine = "Нужно минимум 4 игрока в игре.";
    } else if (
      nextUnlockRemainSec > 0 &&
      !exhaustedHidden &&
      !exhaustedPersonal &&
      !(modeHiddenThreat && lowPlayers)
    ) {
      actionStatusLine = `Будет доступно через ${formatEarlyLock(nextUnlockRemainSec)}`;
    }

    const buttonsMuted =
      voteOpen ||
      killSplash ||
      exhaustedHidden ||
      exhaustedPersonal ||
      (modeHiddenThreat && lowPlayers) ||
      nextUnlockRemainSec > 0;

    const title = chaosMode
      ? "ДЕЙСТВИЕ ШПИОНА · Команда: СКРЫТО"
      : multiSpyTeam
        ? `ДЕЙСТВИЕ ШПИОНА · Команда: ${initialSpies}`
        : "ДЕЙСТВИЕ ШПИОНА";
    const subtitle = chaosMode
      ? "Команда неизвестна. 1 действие"
      : multiSpyTeam
        ? `На команду: ${initialSpies} действия`
        : "2 действия за игру. Перезарядка 3 мин";

    return {
      title,
      modeHiddenThreat,
      actionStatusLine,
      buttonsMuted,
      guessDisabled,
      guessUsed: guessMaxed,
      onGuessClick: () => setSpyGuessModalOpen(true),
      subtitle,
      killDisabled,
      killUsed: kills >= 2 || combinedExhausted,
      onKillClick: () => setSpyKillModalOpen(true),
    };
  }, [
    stateJson,
    isDiscussion,
    me?.isSpy,
    me?.spyGuessUses,
    meEliminated,
    isEndedPhase,
    status,
    spyGuessCooldownRemainSec,
    spyKillCooldownRemainSec,
    alivePlayerCount,
    playerRows,
    lobbyModes?.mode_spy_chaos,
    now,
  ]);

  const spyGuessEligibleIds = useMemo(() => {
    if (!stateJson?.spyGuessSpyId) return [];
    const sid = stateJson.spyGuessSpyId;
    return playerRows
      .filter((p) => !p.eliminated && !p.isSpy && p.id !== sid)
      .map((p) => p.id);
  }, [stateJson?.spyGuessSpyId, playerRows]);

  const submitSpyGuess = useCallback((text: string) => {
    colyseusRoomRef.current?.send(WS_CLIENT_MESSAGE.spyGuessSubmit, { text });
  }, []);

  const submitSpyKill = useCallback((targetId: string) => {
    colyseusRoomRef.current?.send(WS_CLIENT_MESSAGE.spyKillSubmit, { targetId });
  }, []);

  const castSpyGuessVote = useCallback((vote: "yes" | "no") => {
    colyseusRoomRef.current?.send(WS_CLIENT_MESSAGE.spyGuessVoteCast, { vote });
  }, []);

  useEffect(() => {
    if (stateJson?.spyGuessVoteEndsAt && stateJson.spyGuessVoteEndsAt > 0) {
      setSpyGuessModalOpen(false);
    }
  }, [stateJson?.spyGuessVoteEndsAt]);

  useEffect(() => {
    if (stateJson?.matchSplashType === "spy_kill") setSpyKillModalOpen(false);
  }, [stateJson?.matchSplashType]);

  const votingPlayersById = useMemo(() => {
    if (!stateJson) return {};
    const out: Record<string, MatchVotingOverlayPlayer> = {};
    for (const p of Object.values(stateJson.players)) {
      out[p.id] = { id: p.id, nickname: p.nickname, avatarId: p.avatarId, isHost: p.isHost };
    }
    return out;
  }, [stateJson]);

  const eliminatedPlayerIds = useMemo(() => {
    const s = new Set<string>();
    for (const p of playerRows) {
      if (p.eliminated) s.add(p.id);
    }
    return s;
  }, [playerRows]);

  /** Заморозка пропсов на момент ухода с `phase === "voting"`, чтобы exit-анимации полосок не обрывались. */
  const matchVotingFrozenRef = useRef<{
    voteStage: string;
    voteEndsAt: number;
    voteTransitionEndsAt: number;
    revoteA: string;
    revoteB: string;
    stubEliminatedId: string;
    voteIsFinal: boolean;
    voteFinalSpiesRemaining: number;
    playersById: Record<string, MatchVotingOverlayPlayer>;
    voteBallots: Record<string, string>;
    eliminatedPlayerIds: Set<string>;
  } | null>(null);
  const matchPhaseForVotingExitRef = useRef<string | undefined>(undefined);
  const [, bumpMatchVotingOverlayHost] = useReducer((x: number) => x + 1, 0);

  const debugPanelOpen = readMatchDebug();

  const matchPausedUi =
    matchPauseFromRoom.paused || (stateJson?.matchPaused === true);
  /** Ч/Б оверлей и «ПАУЗА» на таймере только для паузы ведущего в фазе обсуждения, не во время голосования. */
  const hostDiscussionPause = isDiscussion && matchPausedUi;

  const matchPauseValue = useMemo(
    () => ({
      isPaused: hostDiscussionPause,
      frozenRemainingSec: matchPauseFromRoom.remainingSec,
    }),
    [hostDiscussionPause, matchPauseFromRoom.remainingSec],
  );

  const hostPauseDisabled =
    isVotingPhase ||
    Boolean(stateJson?.matchSplashType) ||
    showSpyGuessVoteOverlay ||
    showSpyGuessCinematic;

  const hostShuffleDisabled =
    !stateJson || Object.keys(stateJson.players).length < 2 || hostPauseDisabled;

  const hostAside =
    isMatchHost && !isMobile ? (
      <MatchGameHostButtons
        layout="fixed"
        isPaused={hostDiscussionPause}
        pausingGame={pauseBusy}
        pauseDisabled={hostPauseDisabled}
        onPause={pauseMatch}
        onResume={resumeMatch}
        onEndGame={() => void endMatch()}
        onShufflePlayerOrder={shufflePlayerOrder}
        shuffleDisabled={hostShuffleDisabled}
      />
    ) : null;

  const matchFooterBar = isMobile ? (
    <FooterBar
      variant="game"
      leftSlot={<MatchHintQuestionButton gameId={dbRoomId ?? null} />}
      isHost={isMatchHost}
      gameHostPanel={
        isMatchHost ? (
          <MatchGameHostButtons
            layout="footer"
            isPaused={hostDiscussionPause}
            pausingGame={pauseBusy}
            pauseDisabled={hostPauseDisabled}
            onPause={pauseMatch}
            onResume={resumeMatch}
            onEndGame={() => void endMatch()}
            onShufflePlayerOrder={shufflePlayerOrder}
            shuffleDisabled={hostShuffleDisabled}
          />
        ) : null
      }
    />
  ) : null;

  const footerExtras = debugPanelOpen ? (
    <>
      {playBundle ? (
        <>
          <div className="card card--panel" style={{ marginTop: "1rem" }}>
            <p className="card__title">matchDebug: лобби (Supabase) ↔ игра</p>
            <p className={styles.devNote}>
              <span className="card__mono">rawRoomSettings</span> и <span className="card__mono">normalizedLobbySettings</span> — из{" "}
              <span className="card__mono">rooms.settings</span> при открытии матча. <span className="card__mono">colyseusState</span> — срез
              состояния комнаты Colyseus; <span className="card__mono">matchAssignmentMessage</span> — отдельное WS-сообщение с темой/ролью.
            </p>
            <pre className={`card__mono ${styles.devPre}`}>
              {JSON.stringify(
                {
                  rawRoomSettings: playBundle.rawRoomSettings,
                  normalizedLobbySettings: playBundle.lobbySettings,
                  colyseusReservedIdFromSettings: playBundle.colyseusRoomId ?? null,
                  colyseusState: stateJson
                    ? {
                        matchSessionId: stateJson.matchSessionId,
                        phase: stateJson.phase,
                        matchEndsAt: stateJson.matchEndsAt,
                        locationName: stateJson.locationName,
                        locationImageKey: stateJson.locationImageKey,
                        themeText: stateJson.themeText,
                        modeTheme: stateJson.modeTheme,
                        modeRole: stateJson.modeRole,
                        playersCount: Object.keys(stateJson.players).length,
                        voteStage: stateJson.voteStage,
                        earlyVotesUsed: stateJson.earlyVotesUsed,
                        earlyAckCount: Object.keys(stateJson.earlyVoteAck).length,
                        votingDurationSec: stateJson.votingDurationSec,
                      }
                    : null,
                  matchAssignmentMessage: assignmentPatch,
                },
                null,
                2,
              )}
            </pre>
          </div>

          <div className="card card--panel" style={{ marginTop: "1rem" }}>
            <p className="card__title">matchDebug: таблица locations</p>
            <p className={styles.devNote}>
              При старте игры сервер в POST <span className="card__mono">/api/game/start</span> читает все строки{" "}
              <span className="card__mono">locations</span> и выбирает случайную; темы/роли берутся из её массивов. Здесь для сверки запрос к
              Supabase по <span className="card__mono">image_key</span> из состояния Colyseus, иначе по <span className="card__mono">name</span>.
            </p>
            {locationDev.status === "idle" ? (
              <p className={styles.muted}>Нет полей локации в состоянии Colyseus — подключись и дождись синхронизации.</p>
            ) : null}
            {locationDev.status === "loading" ? <p className={styles.muted}>Запрос к Supabase…</p> : null}
            {locationDev.status === "error" ? (
              <p className={styles.muted} style={{ color: "var(--danger, #c44)" }}>
                {locationDev.message}
              </p>
            ) : null}
            {locationDev.status === "ok" ? (
              <>
                <p className={styles.muted}>
                  Совпадение по колонке: <span className="card__mono">{locationDev.matchBy}</span>
                </p>
                <pre className={`card__mono ${styles.devPre}`}>{JSON.stringify(locationDev.row, null, 2)}</pre>
              </>
            ) : null}
          </div>
        </>
      ) : null}
      {matchDebugDump ? (
        <div className="card card--panel">
          <p className="card__title">matchDebug: полный дамп sync (Colyseus)</p>
          <pre
            className="card__mono"
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: "0.75rem",
              maxHeight: "24rem",
              overflow: "auto",
            }}
          >
            {matchDebugDump}
          </pre>
        </div>
      ) : null}
    </>
  ) : null;

  matchPhaseForVotingExitRef.current = stateJson?.phase;

  const voteStageNow = stateJson?.voteStage;
  const prevVoteStage = prevVoteStageRef.current;
  const enteredEliminationFromVotingUi =
    voteStageNow === "elimination_splash" &&
    prevVoteStage != null &&
    VOTE_OVERLAY_STAGES_BEFORE_ELIMINATION_SPLASH.has(prevVoteStage);

  if (enteredEliminationFromVotingUi) {
    suppressSplashUntilVoteExitRef.current = true;
    eliminationSplashAllowedAfterVoteExitRef.current = false;
  }
  if (voteStageNow !== "elimination_splash") {
    suppressSplashUntilVoteExitRef.current = false;
    eliminationSplashAllowedAfterVoteExitRef.current = true;
  }

  if (stateJson?.phase === "voting" && stateJson.voteStage !== "elimination_splash") {
    matchVotingFrozenRef.current = {
      voteStage: stateJson.voteStage,
      voteEndsAt: stateJson.voteEndsAt,
      voteTransitionEndsAt: stateJson.voteTransitionEndsAt,
      revoteA: stateJson.revoteA,
      revoteB: stateJson.revoteB,
      stubEliminatedId: stateJson.stubEliminatedId,
      voteIsFinal: stateJson.voteIsFinal,
      voteFinalSpiesRemaining: stateJson.voteFinalSpiesRemaining,
      playersById: { ...votingPlayersById },
      voteBallots: { ...stateJson.voteBallots },
      eliminatedPlayerIds: new Set(eliminatedPlayerIds),
    };
  }

  const votingOverlayActive =
    stateJson?.phase === "voting" && stateJson.voteStage !== "elimination_splash";

  const needsDelayedEliminationSplash =
    stateJson?.matchSplashType === "voting_kicked_civilian" &&
    stateJson?.phase === "voting" &&
    stateJson?.voteStage === "elimination_splash";

  const showMatchSplashLayer =
    Boolean(stateJson?.matchSplashType) &&
    (!needsDelayedEliminationSplash || eliminationSplashAllowedAfterVoteExitRef.current);

  prevVoteStageRef.current = voteStageNow;

  return (
    <MatchPauseProvider value={matchPauseValue}>
      <MatchPauseGrayscaleOverlay active={hostDiscussionPause} />
      {stateJson && showMatchSplashLayer ? (
        <MatchColyseusSplashLayer
          matchSplashType={stateJson.matchSplashType}
          matchSplashAt={stateJson.matchSplashAt}
          matchSplashEndsAt={stateJson.matchSplashEndsAt}
          matchSplashEliminatedId={stateJson.matchSplashEliminatedId}
          matchSplashVotePercent={stateJson.matchSplashVotePercent}
          matchSplashEliminationGameOver={stateJson.matchSplashEliminationGameOver}
          guessedSpyId={stateJson.spyGuessSpyId || stateJson.matchSplashEliminatedId}
          players={stateJson.players}
          clockSkewMs={clockSkewMs}
          initialSpyCount={stateJson.initialSpyCount}
          modeSpyChaos={lobbyModes?.mode_spy_chaos === true}
          isMatchHost={isMatchHost}
          onVictoryHostEndGame={endMatch}
          victoryEndGameBusy={endMatchBusy}
        />
      ) : null}
      {stateJson && matchVotingFrozenRef.current ? (
        <MatchVotingOverlay
          active={votingOverlayActive}
          onVotingRootExitComplete={() => {
            if (suppressSplashUntilVoteExitRef.current) {
              suppressSplashUntilVoteExitRef.current = false;
              eliminationSplashAllowedAfterVoteExitRef.current = true;
              bumpEliminationSplashAfterVoteExit();
              return;
            }
            if (matchPhaseForVotingExitRef.current === "voting") return;
            matchVotingFrozenRef.current = null;
            bumpMatchVotingOverlayHost();
          }}
          room={colyseusRoom}
          {...matchVotingFrozenRef.current}
          currentPlayerId={effectivePlayerId}
          clockSkewMs={clockSkewMs}
          modeSpyChaos={lobbyModes?.mode_spy_chaos === true}
        />
      ) : null}
      <DebugPanelDev
        open={debugPanelOpen}
        roomCode={sessionId}
        canEndMatch={isMatchHost && !!dbRoomId}
        endMatchBusy={endMatchBusy}
        endMatchError={endMatchError}
        onEndMatch={endMatch}
        colyseusUrl={effectiveColyseusUrl}
        connectionStatus={status}
        connectErrorDetail={connectErrorDetail}
        pong={pong}
      />
      <MatchGamePageLayout
        isMobile={isMobile}
        topInsetPx={debugPanelOpen ? 72 : 0}
        themeCardValue={themeForCard}
        locationCardValue={locationForCard}
        roleCardValue={roleForCard}
        isSpy={me?.isSpy === true}
        players={listPlayers}
        currentPlayerId={effectivePlayerId}
        onlinePlayers={onlineIds}
        clockDisplay={clockDisplay}
        timerTone={timerTone}
        timerPaused={hostDiscussionPause}
        locationImageKey={stateJson?.locationImageKey ?? ""}
        spyCardUrl={me?.spyCardUrl ?? ""}
        hostAside={hostAside}
        footerExtras={footerExtras}
        hintGameId={dbRoomId || null}
        footerBar={matchFooterBar}
        earlyVoteShowPrimary={earlyShowPrimary}
        earlyVotePrimaryLabel={`ГОЛОСОВАТЬ ${earlyAckCount}/${earlyMajority}`}
        earlyVoteSecondaryLabel={earlySecondaryLabel}
        earlyVoteIsActive={
          !meEliminated && stateJson?.earlyVoteAck[effectivePlayerId] === "1"
        }
        onEarlyVoteToggle={() => colyseusRoomRef.current?.send(WS_CLIENT_MESSAGE.earlyVoteToggle, {})}
        earlyVoteDisabled={status !== "ok"}
        earlyVoteEliminated={meEliminated}
        spyBlockLive={spyBlockLive}
      />
      <MatchSpyGuessLocationModal
        open={spyGuessModalOpen}
        onClose={() => setSpyGuessModalOpen(false)}
        onSubmit={submitSpyGuess}
      />
      <MatchSpyEliminateModal
        open={spyKillModalOpen}
        onClose={() => setSpyKillModalOpen(false)}
        players={listPlayers}
        onEliminate={submitSpyKill}
      />
      {stateJson && showSpyGuessVoteOverlay ? (
        <MatchSpyGuessVoteOverlay
          open
          guessText={stateJson.spyGuessText}
          spyGuessSpyId={stateJson.spyGuessSpyId}
          eligibleIds={spyGuessEligibleIds}
          ballots={stateJson.spyGuessBallots}
          currentPlayerId={effectivePlayerId}
          voteEndsAt={stateJson.spyGuessVoteEndsAt}
          clockSkewMs={clockSkewMs}
          voteStartsAtMs={stateJson.spyGuessVoteStartsAt}
          underEmergencyLayer={showSpyGuessCinematic}
          votingLocked={!spyGuessVoteGatePassed}
          voteOpensRemainSec={spyGuessVoteOpensRemainSec}
          isAutoWin={stateJson.spyGuessIsAutoWin === true}
          onVote={castSpyGuessVote}
        />
      ) : null}
      {showSpyGuessCinematic && spyGuessSessionKey ? (
        <MatchSpyGuessEmergencyIntroLayer
          key={spyGuessSessionKey}
          variant="match"
          open
          onClose={() => {}}
          onExitFallStart={() => setSpyGuessExitFallStarted(true)}
          onMatchCinematicComplete={() => {
            setSpyGuessCinematicDone(true);
            if (typeof window !== "undefined" && spyGuessSessionKey) {
              try {
                sessionStorage.setItem(
                  SPY_GUESS_INTRO_DONE_STORAGE_PREFIX + spyGuessSessionKey,
                  "1",
                );
              } catch {
                /* private mode */
              }
            }
          }}
          hint={null}
        />
      ) : null}
    </MatchPauseProvider>
  );
}
