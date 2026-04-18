export { GameState, MatchPlayerState } from "./colyseus/gameState";

export {
  SPY_GUESS_CINEMATIC_TOTAL_MS,
  SPY_GUESS_AUTO_WIN_PHASE_MS,
} from "./spyGuessTiming";

export { SPY_KILL_FIRST_UNLOCK_MS, SPY_KILL_COOLDOWN_BETWEEN_MS } from "./spyKillTiming";

export { isMultiSpyNetworkSelectable, multiSpyCountForPlayerCount } from "./spyNetworkCount";

export const GAME_NAME = "Spyfall";

/** Colyseus room name clients join after host starts a match */
export const COLYSEUS_ROOM_NAME = "spyfall" as const;

export const MATCH_PHASES = [
  "lobby",
  "discussion",
  "voting",
  "resolution",
  "ended",
] as const;

export type MatchPhase = (typeof MATCH_PHASES)[number];

/** Default main discussion length when the client does not pass a duration (15 min). */
export const DEFAULT_DISCUSSION_DURATION_MS = 15 * 60 * 1000;

/**
 * Options for `joinOrCreate` / `create` — must match across clients so Colyseus routes them into the same room.
 * `matchSessionId` should be the Supabase `match_sessions.id` once you add it; until then use a stable stub per match.
 */
export type MatchJoinOptions = {
  matchSessionId: string;
  playerId: string;
  nickname: string;
  discussionDurationMs?: number;
  /** Длительность фазы голосования (мс), из настроек лобби */
  votingDurationMs?: number;
};

/** Client → server message types (string payloads for a minimal template) */
export const WS_CLIENT_MESSAGE = {
  ping: "ping",
  /** Ведущий: пауза обсуждения (сервер фиксирует дедлайн). */
  matchPause: "matchPause",
  /** Ведущий: продолжить — дедлайн сдвигается на время паузы. */
  matchResume: "matchResume",
  /** Досрочное голосование: переключить своё согласие (>50% — старт). */
  earlyVoteToggle: "earlyVoteToggle",
  /** Активная фаза голосования: голос за игрока `{ targetId }`. */
  voteCast: "voteCast",
  voteSkip: "voteSkip",
  spyGuessSubmit: "spyGuessSubmit",
  spyGuessVoteCast: "spyGuessVoteCast",
  /** Шпион в режиме «Скрытая угроза»: `{ targetId }` — жертва до сплэша. */
  spyKillSubmit: "spyKillSubmit",
  /** Ведущий: новый случайный порядок карточек игроков в UI (Fisher–Yates от последнего индекса). */
  hostShufflePlayerOrder: "hostShufflePlayerOrder",
} as const;

/** Server → client: тема/роли для карточки (дубль state, если декод Schema на клиенте глючит). */
export const WS_SERVER_MESSAGE = {
  matchAssignment: "matchAssignment",
} as const;

export type MatchAssignmentPayload = {
  themeText: string;
  modeTheme: boolean;
  modeRole: boolean;
  roleAtLocation: string;
};
