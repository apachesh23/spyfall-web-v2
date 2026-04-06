"use client";

import { Client, type Room } from "colyseus.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useState, useMemo } from "react";
import {
  COLYSEUS_ROOM_NAME,
  GameState,
  WS_CLIENT_MESSAGE,
  WS_SERVER_MESSAGE,
  type MatchAssignmentPayload,
} from "@spyfall/shared";
import { peekStashedRoomPlayer } from "@/lib/roomIdentityRecovery";
import { supabase } from "@/lib/supabase/client";
import {
  locationImageCandidates,
  locationImageFallbackSrc,
} from "@/lib/locations";
import { normalizeRoomSettings } from "@/lib/normalizeRoomSettings";
import type { Settings } from "@/types/room";
import { PlayerList } from "@/features/player";
import type { AvatarId } from "@/lib/avatars";
import type { Player } from "@/types/player";
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
};

export type GameStateJson = {
  phase: string;
  matchEndsAt: number;
  matchSessionId: string;
  locationName: string;
  locationImageKey: string;
  themeText: string;
  modeTheme: boolean;
  modeRole: boolean;
  players: Record<string, MatchPlayerJson>;
};

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

function strField(p: Record<string, unknown>, camel: string, snake: string): string {
  const a = p[camel];
  const b = p[snake];
  if (typeof a === "string") return a;
  if (typeof b === "string") return b;
  return "";
}

function extractPlayer(p: Record<string, unknown> | null | undefined): MatchPlayerJson | null {
  if (!p || typeof p !== "object") return null;
  if (typeof p.id !== "string" || typeof p.nickname !== "string") return null;
  const avatarRaw = num(p.avatarId ?? p.avatar_id);
  return {
    id: p.id,
    nickname: p.nickname,
    avatarId: avatarRaw >= 1 && avatarRaw <= 16 ? Math.floor(avatarRaw) : 1,
    isHost: asBool(p.isHost ?? p.is_host),
    isSpy: asBool(p.isSpy ?? p.is_spy),
    roleAtLocation: strField(p, "roleAtLocation", "role_at_location"),
    spyCardUrl: strField(p, "spyCardUrl", "spy_card_url"),
  };
}

function snapshotMatchState(room: Room): GameStateJson | null {
  const s = room.state as unknown;
  if (s === null || s === undefined) return null;

  const players: GameStateJson["players"] = {};

  type LooseState = {
    phase?: string;
    matchEndsAt?: number;
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
    } catch {
      /* ignore */
    }
  }

  return {
    phase,
    matchEndsAt,
    matchSessionId,
    locationName,
    locationImageKey,
    themeText,
    modeTheme,
    modeRole,
    players,
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

function toLobbyPlayers(rows: MatchPlayerJson[], roomId: string): Player[] {
  return [...rows]
    .sort((a, b) => a.nickname.localeCompare(b.nickname))
    .map((p) => ({
      id: p.id,
      nickname: p.nickname,
      avatar_id: Math.min(16, Math.max(1, p.avatarId)) as AvatarId,
      is_host: p.isHost,
      room_id: roomId,
      joined_at: "",
    }));
}

export function MatchScreen({ sessionId, colyseusUrl }: MatchScreenProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "connecting" | "ok" | "error">(
    "idle",
  );
  const [connectErrorDetail, setConnectErrorDetail] = useState<string | null>(null);
  const [pong, setPong] = useState<string | null>(null);
  const [stateJson, setStateJson] = useState<GameStateJson | null>(null);
  const [clockSkewMs, setClockSkewMs] = useState(0);
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

  const lobbyPlayerId = getLobbyPlayerId(sessionId);
  const effectivePlayerId = lobbyPlayerId ?? getOrCreateDevicePlayerId();
  const dbRoomId = playBundle?.dbRoomId ?? "";
  const isMatchHost = !!playBundle && !!lobbyPlayerId && lobbyPlayerId === playBundle.hostId;

  useEffect(() => {
    const id = window.setInterval(() => {
      bumpUi();
    }, 500);
    return () => window.clearInterval(id);
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
      setJoinNickname(null);
      setJoinIdentityReady(false);
      return;
    }
    if (!lobbyPlayerId) {
      setJoinNickname(null);
      setJoinIdentityReady(true);
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
      const n = data?.nickname && typeof data.nickname === "string" ? data.nickname.trim() : "";
      setJoinNickname(n ? n.slice(0, 48) : null);
      setJoinIdentityReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [playBundle?.dbRoomId, lobbyPlayerId]);

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
          const next = payload.new as { status?: string };
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
      }
    } catch {
      setEndMatchError("Сеть или сервер недоступны");
    } finally {
      setEndMatchBusy(false);
    }
  }, [dbRoomId, lobbyPlayerId]);

  useEffect(() => {
    if (!playBundle || !joinIdentityReady) return;

    let disposed = false;
    const client = new Client(colyseusUrl);
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
              colyseusUrl,
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
      setAssignmentPatch(null);
      void room?.leave();
    };
  }, [colyseusUrl, sessionId, playBundle, effectivePlayerId, joinNickname, joinIdentityReady]);

  const now = Date.now() + clockSkewMs;
  const remainingMs =
    stateJson && stateJson.matchEndsAt > 0 ? Math.max(0, stateJson.matchEndsAt - now) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  const playerRows = stateJson ? Object.values(stateJson.players) : [];
  const listPlayers = stateJson && dbRoomId ? toLobbyPlayers(playerRows, dbRoomId) : [];
  const onlineIds = new Set(playerRows.map((p) => p.id));
  const me = stateJson?.players[effectivePlayerId] ?? null;

  const locationCandidates = useMemo(
    () => locationImageCandidates(stateJson?.locationImageKey ?? ""),
    [stateJson?.locationImageKey],
  );
  const locationIdxMax = Math.max(0, locationCandidates.length - 1);
  const [locationImgAttempt, setLocationImgAttempt] = useState(0);
  useEffect(() => {
    setLocationImgAttempt(0);
  }, [stateJson?.locationImageKey]);

  const locationImgIdx = Math.min(locationImgAttempt, locationIdxMax);
  const locationImgShown =
    locationCandidates[locationImgIdx] ?? locationImageFallbackSrc();

  const lobbyModes = playBundle?.lobbySettings;
  const themeSnapshot = lobbyModes?.match_theme_snapshot?.trim() ?? "";
  /** Приоритет: реплицированный state Colyseus (источник правды в матче), затем WS matchAssignment, затем снимок из Supabase. */
  const themeTextMerged =
    stateJson?.themeText?.trim() ||
    assignmentPatch?.themeText?.trim() ||
    themeSnapshot ||
    "";
  const roleTextMerged =
    me?.roleAtLocation?.trim() || assignmentPatch?.roleAtLocation?.trim() || "";

  /** Режимы включены где угодно из лобби / Colyseus / WS — чтобы подпись «выключено» не путать с багом, когда флаги расходятся. */
  const themeModeOn =
    lobbyModes?.mode_theme === true ||
    asBool(stateJson?.modeTheme) ||
    asBool(assignmentPatch?.modeTheme);
  const roleModeOn =
    lobbyModes?.mode_roles === true ||
    (stateJson != null && asBool(stateJson.modeRole)) ||
    asBool(assignmentPatch?.modeRole);

  const themeLineBody = themeTextMerged
    ? themeTextMerged
    : themeModeOn
      ? "для этой локации в БД нет строк в themes[] — добавь темы в таблицу locations"
      : "выключено в настройках лобби (режим темы)";
  const roleLineBody = roleTextMerged
    ? roleTextMerged
    : roleModeOn
      ? "для этой локации в БД нет roles[] или список пуст — добавь роли в таблицу locations"
      : "выключено в настройках лобби (режим ролей)";

  return (
    <div className="shell shell--wide">
      <Link href="/" className="link-muted">
        ← На главную
      </Link>
      <div>
        <h1 className="title-page">Матч</h1>
        <p className="lead">
          Комната: <span className="mono-inline">{sessionId}</span>
        </p>
        <p className="lead muted">
          Таймер задаётся из настроек лобби (длительность игры). Для отладки Colyseus:{" "}
          <span className="mono-inline">?matchDebug=1</span>
        </p>
      </div>

      {isMatchHost ? (
        <div className="card card--panel">
          <p className="card__title">Ведущий</p>
          <p className="card__row muted" style={{ lineHeight: 1.5 }}>
            Завершить матч — все вернутся в лобби.
          </p>
          {endMatchError ? (
            <p className="card__row muted" style={{ color: "var(--danger, #c44)" }}>
              {endMatchError}
            </p>
          ) : null}
          <p className="card__row">
            <button
              type="button"
              className="btn-secondary"
              disabled={endMatchBusy || !dbRoomId}
              onClick={() => void endMatch()}
            >
              {endMatchBusy ? "Завершение…" : "Завершить матч"}
            </button>
          </p>
        </div>
      ) : dbRoomId ? (
        lobbyPlayerId ? (
          <p className="lead muted">
            Ты не ведущий: дождись «Завершить матч» от ведущего.
          </p>
        ) : (
          <p className="lead muted">
            Зайди в игру из лобби по коду — подставится твой ник и id из базы.
          </p>
        )
      ) : null}

      <div className={styles.grid}>
        <div className={styles.panel}>
          <p className={styles.panelTitle}>Время</p>
          <p className={styles.timer} aria-live="polite">
            {stateJson?.phase === "discussion" ? formatClock(remainingSec) : "—"}
          </p>
          <p className={styles.phase}>
            Фаза: {stateJson?.phase === "discussion" ? "обсуждение" : stateJson?.phase ?? "—"}
          </p>
        </div>

        <div className={styles.panel}>
          <p className={styles.panelTitle}>Твоя карточка</p>
          {!me ? (
            <p className={styles.muted}>Подключись к комнате…</p>
          ) : me.isSpy ? (
            <>
              {me.spyCardUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.spyCardUrl} alt="" className={styles.locationImg} />
              ) : null}
              <p className={styles.locationName}>Ты шпион</p>
              <p className={styles.themeLine}>
                <strong>Тема локации:</strong> {themeLineBody}
              </p>
              <p className={styles.muted}>
                Локацию и свою роль на ней знают только мирные. Тему видят все — используй её, чтобы не выделяться.
              </p>
              <span className={styles.spyBadge}>ШПИОН</span>
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={`loc-${stateJson?.locationImageKey ?? ""}-${locationImgIdx}`}
                src={locationImgShown}
                alt=""
                className={styles.locationImg}
                onError={() => {
                  setLocationImgAttempt((a) => (a < locationIdxMax ? a + 1 : a));
                }}
              />
              <p className={styles.locationName}>{stateJson?.locationName ?? "Локация"}</p>
              <p className={styles.themeLine}>
                <strong>Тема локации:</strong> {themeLineBody}
              </p>
              <p className={styles.roleLine}>
                <strong>Роль на локации:</strong> {roleLineBody}
              </p>
              <p className={styles.muted}>Ты мирный агент. Найди шпиона.</p>
            </>
          )}
        </div>
      </div>

      <div className={`${styles.panel} ${styles.playerListWrap}`} style={{ marginTop: "1rem" }}>
        <p className={styles.panelTitle}>Игроки</p>
        {listPlayers.length > 0 ? (
          <PlayerList
            players={listPlayers}
            currentPlayerId={effectivePlayerId}
            onlinePlayers={onlineIds}
            isHost={false}
            layout="game"
            hideMinPlaceholders
          />
        ) : (
          <p className={styles.muted}>Список появится после синхронизации с сервером.</p>
        )}
      </div>

      <div className="card card--panel" style={{ marginTop: "1rem" }}>
        <p className="card__title">Colyseus</p>
        <p className="card__row">
          URL: <span className="card__mono">{colyseusUrl}</span>
        </p>
        <p className="card__row">
          Статус:{" "}
          <span className="card__mono">
            {status === "idle" && "ожидание"}
            {status === "connecting" && "подключение…"}
            {status === "ok" && "в комнате"}
            {status === "error" && "нет соединения с game-server"}
          </span>
        </p>
        {status === "error" ? (
          <p className="card__row muted" style={{ marginTop: "0.75rem", lineHeight: 1.5 }}>
            Проверка: <span className="card__mono">{colyseusUrl}/health</span>
            {connectErrorDetail ? (
              <>
                <br />
                <span className="card__mono" style={{ fontSize: "0.85em", wordBreak: "break-all" }}>
                  {connectErrorDetail}
                </span>
              </>
            ) : null}
          </p>
        ) : null}
        {pong ? <p className="pong-line">pong: {pong}</p> : null}
      </div>

      {readMatchDebug() && playBundle ? (
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

      {readMatchDebug() && matchDebugDump ? (
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
    </div>
  );
}
