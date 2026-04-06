import type { Client } from "@colyseus/core";
import { Room } from "@colyseus/core";
import {
  WS_CLIENT_MESSAGE,
  WS_SERVER_MESSAGE,
  type MatchJoinOptions,
} from "../matchContract.js";
import { GameState, MatchPlayerState } from "../schema/GameState.js";

type SpyfallGameState = InstanceType<typeof GameState>;

/** Синхронизировать с packages/shared `DEFAULT_DISCUSSION_DURATION_MS`. */
const DEFAULT_DISCUSSION_DURATION_MS = 15 * 60 * 1000;

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

export class SpyfallRoom extends Room<SpyfallGameState> {
  private clientToPlayerId = new Map<string, string>();

  override onCreate(options: Record<string, unknown> & Partial<MatchJoinOptions>) {
    const matchSessionId = typeof options.matchSessionId === "string" ? options.matchSessionId.trim() : "";
    if (!matchSessionId) {
      throw new Error("SpyfallRoom: matchSessionId is required");
    }

    const durationMs =
      typeof options.discussionDurationMs === "number" && Number.isFinite(options.discussionDurationMs)
        ? Math.max(30_000, Math.min(3_600_000, Math.floor(options.discussionDurationMs)))
        : DEFAULT_DISCUSSION_DURATION_MS;

    const rosterRaw = options.roster;
    if (!Array.isArray(rosterRaw) || rosterRaw.length === 0) {
      throw new Error("SpyfallRoom: roster is required and must be non-empty");
    }

    this.setState(new GameState());
    this.state.matchSessionId = matchSessionId;
    this.state.phase = "discussion";
    this.state.matchEndsAt = Date.now() + durationMs;

    this.state.locationName = typeof options.locationName === "string" ? options.locationName : "";
    this.state.locationImageKey =
      typeof options.locationImageKey === "string" ? options.locationImageKey : "";
    this.state.themeText = typeof options.themeText === "string" ? options.themeText : "";
    this.state.modeTheme = bool(options.modeTheme);
    this.state.modeRole = bool(options.modeRole);

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
      this.state.players.set(id, p);
    }

    this.autoDispose = true;

    this.onMessage(WS_CLIENT_MESSAGE.ping, (client: Client, payload: { t?: number }) => {
      client.send("pong", { t: payload?.t ?? 0, serverTime: Date.now() });
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

  private tickTimer() {
    if (this.state.phase !== "discussion") {
      return;
    }
    if (this.state.matchEndsAt <= 0) {
      return;
    }
    if (Date.now() < this.state.matchEndsAt) {
      return;
    }
    this.state.phase = "voting";
  }
}
