export const GAME_NAME = "Spyfall";

/** Colyseus room name clients join after host starts a match */
export const COLYSEUS_ROOM_NAME = "spyfall" as const;

export const MATCH_PHASES = [
  "lobby",
  "discussion",
  "voting",
  "resolution",
] as const;

export type MatchPhase = (typeof MATCH_PHASES)[number];

/** Client → server message types (string payloads for a minimal template) */
export const WS_CLIENT_MESSAGE = {
  ping: "ping",
} as const;
