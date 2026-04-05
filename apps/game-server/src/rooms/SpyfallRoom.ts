import type { Client } from "@colyseus/core";
import { Room } from "@colyseus/core";
import { WS_CLIENT_MESSAGE, type MatchJoinOptions } from "../matchContract.js";
import { GameState, MatchPlayerState } from "../schema/GameState.js";

type SpyfallGameState = InstanceType<typeof GameState>;

/** Синхронизировать с packages/shared `DEFAULT_DISCUSSION_DURATION_MS` (tsx + ESM иногда не подхватывает константу из workspace .ts). */
const DEFAULT_DISCUSSION_DURATION_MS = 15 * 60 * 1000;

export class SpyfallRoom extends Room<SpyfallGameState> {
  private clientToPlayerId = new Map<string, string>();

  override onCreate(options: Partial<MatchJoinOptions>) {
    const matchSessionId = typeof options.matchSessionId === "string" ? options.matchSessionId.trim() : "";
    if (!matchSessionId) {
      throw new Error("SpyfallRoom: matchSessionId is required");
    }

    const durationMs =
      typeof options.discussionDurationMs === "number" && Number.isFinite(options.discussionDurationMs)
        ? Math.max(30_000, Math.min(3_600_000, Math.floor(options.discussionDurationMs)))
        : DEFAULT_DISCUSSION_DURATION_MS;

    this.setState(new GameState());
    this.state.matchSessionId = matchSessionId;
    this.state.phase = "discussion";
    this.state.matchEndsAt = Date.now() + durationMs;

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

    const nicknameRaw = typeof options.nickname === "string" ? options.nickname.trim() : "";
    const nickname = nicknameRaw.slice(0, 48) || "Игрок";

    this.clientToPlayerId.set(client.sessionId, playerId);

    const existing = this.state.players.get(playerId);
    if (existing) {
      existing.nickname = nickname;
    } else {
      const row = new MatchPlayerState();
      row.id = playerId;
      row.nickname = nickname;
      this.state.players.set(playerId, row);
    }

    console.log(
      `[SpyfallRoom] onJoin roomId=${this.roomId} playerId=${playerId} nickname=${nickname} players.size=${this.state.players.size}`,
    );
  }

  override onLeave(client: Client) {
    const playerId = this.clientToPlayerId.get(client.sessionId);
    this.clientToPlayerId.delete(client.sessionId);
    if (playerId) {
      this.state.players.delete(playerId);
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
