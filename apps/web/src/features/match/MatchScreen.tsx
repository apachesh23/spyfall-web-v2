"use client";

import { Client, type Room } from "colyseus.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useState } from "react";
import {
  COLYSEUS_ROOM_NAME,
  DEFAULT_DISCUSSION_DURATION_MS,
  GameState,
  WS_CLIENT_MESSAGE,
} from "@spyfall/shared";
import { peekStashedRoomPlayer } from "@/lib/roomIdentityRecovery";
import { supabase } from "@/lib/supabase/client";

type MatchScreenProps = {
  sessionId: string;
  colyseusUrl: string;
};

type GameStateJson = {
  phase: string;
  matchEndsAt: number;
  matchSessionId: string;
  players: Record<string, { id: string; nickname: string }>;
};

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Состояние — тот же `GameState`, что на сервере (`join*` третьим аргументом).
 * Дополнительно читаем toJSON / forEach / $items на случай смены SDK.
 */
function snapshotMatchState(room: Room): GameStateJson | null {
  const s = room.state as unknown;
  if (s === null || s === undefined) return null;

  const players: GameStateJson["players"] = {};

  type LooseState = {
    phase?: string;
    matchEndsAt?: number;
    matchSessionId?: string;
    _phase?: string;
    _matchEndsAt?: number;
    _matchSessionId?: string;
    players?: {
      forEach?: (cb: (v: { id?: string; nickname?: string }, k: string) => void) => void;
      toJSON?: () => Record<string, unknown>;
      $items?: Map<string, { id?: string; nickname?: string }>;
    };
    toJSON?: () => Record<string, unknown>;
  };

  const loose = s as LooseState;

  if (typeof loose.toJSON === "function") {
    try {
      const j = loose.toJSON();
      const jp = j.players;
      if (jp && typeof jp === "object" && !Array.isArray(jp)) {
        for (const key of Object.keys(jp)) {
          const p = (jp as Record<string, unknown>)[key];
          if (p && typeof p === "object" && p !== null && "id" in p && "nickname" in p) {
            players[String(key)] = {
              id: String((p as { id: unknown }).id),
              nickname: String((p as { nickname: unknown }).nickname),
            };
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (Object.keys(players).length === 0) {
    loose.players?.forEach?.((p, key) => {
      players[String(key)] = {
        id: String(p.id ?? ""),
        nickname: String(p.nickname ?? ""),
      };
    });
  }

  if (Object.keys(players).length === 0 && loose.players?.$items) {
    loose.players.$items.forEach((p, key) => {
      players[String(key)] = {
        id: String(p?.id ?? ""),
        nickname: String(p?.nickname ?? ""),
      };
    });
  }

  if (Object.keys(players).length === 0 && loose.players && typeof loose.players.toJSON === "function") {
    try {
      const raw = loose.players.toJSON();
      for (const key of Object.keys(raw)) {
        const p = raw[key] as unknown;
        if (p && typeof p === "object" && p !== null && "id" in p && "nickname" in p) {
          players[String(key)] = {
            id: String((p as { id: unknown }).id),
            nickname: String((p as { nickname: unknown }).nickname),
          };
        }
      }
    } catch {
      /* ignore */
    }
  }

  let phase = typeof loose.phase === "string" ? loose.phase : "discussion";
  let matchEndsAt = num(loose.matchEndsAt);
  let matchSessionId = typeof loose.matchSessionId === "string" ? loose.matchSessionId : "";

  if (!matchEndsAt) matchEndsAt = num(loose._matchEndsAt);
  if (typeof loose._phase === "string" && loose._phase) phase = loose._phase;
  if (!matchSessionId && typeof loose._matchSessionId === "string") matchSessionId = loose._matchSessionId;

  if (typeof loose.toJSON === "function") {
    try {
      const j = loose.toJSON();
      if (typeof j.phase === "string") phase = j.phase;
      const me = num(j.matchEndsAt);
      if (me > 0) matchEndsAt = me;
      if (typeof j.matchSessionId === "string" && j.matchSessionId) matchSessionId = j.matchSessionId;
    } catch {
      /* ignore */
    }
  }

  return { phase, matchEndsAt, matchSessionId, players };
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

function readDiscussionDurationMs(): number {
  if (typeof window === "undefined") return DEFAULT_DISCUSSION_DURATION_MS;
  const raw = new URLSearchParams(window.location.search).get("discussSec");
  if (!raw) return DEFAULT_DISCUSSION_DURATION_MS;
  const sec = Number(raw);
  if (!Number.isFinite(sec)) return DEFAULT_DISCUSSION_DURATION_MS;
  return Math.max(30, Math.min(3600, Math.floor(sec))) * 1000;
}

/** Диагностика: в URL добавь `matchDebug=1` — в консоли тег [SpyfallMatch] и блок на странице. */
function readMatchDebug(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("matchDebug") === "1";
}

/** Тот же ключ, что в лобби — совпадает с `rooms.host_id` для ведущего. */
function getLobbyPlayerId(roomCode: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`player_${roomCode}`) ?? peekStashedRoomPlayer(roomCode);
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
  } | null>(null);
  const [endMatchBusy, setEndMatchBusy] = useState(false);
  const [endMatchError, setEndMatchError] = useState<string | null>(null);
  const [matchDebugDump, setMatchDebugDump] = useState<string | null>(null);

  const lobbyPlayerId = getLobbyPlayerId(sessionId);
  const dbRoomId = playBundle?.dbRoomId ?? null;
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
      setPlayBundle({ dbRoomId: room.id, hostId: room.host_id, colyseusRoomId });
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

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
  }, [dbRoomId, sessionId, lobbyPlayerId]);

  useEffect(() => {
    if (!playBundle) return;

    let disposed = false;
    const client = new Client(colyseusUrl);
    let room: Room | undefined;

    const run = async () => {
      setStatus("connecting");
      setConnectErrorDetail(null);
      const discussionDurationMs = readDiscussionDurationMs();
      const playerId = getOrCreateDevicePlayerId();
      const joinPayload = {
        matchSessionId: sessionId,
        playerId,
        nickname: `Игрок ${playerId.slice(0, 8)}`,
        discussionDurationMs,
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
      void room?.leave();
    };
  }, [colyseusUrl, sessionId, playBundle]);

  const now = Date.now() + clockSkewMs;
  const remainingMs =
    stateJson && stateJson.matchEndsAt > 0 ? Math.max(0, stateJson.matchEndsAt - now) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const playerList = stateJson
    ? Object.values(stateJson.players).sort((a, b) => a.nickname.localeCompare(b.nickname))
    : [];

  return (
    <div className="shell shell--wide">
      <Link href="/" className="link-muted">
        ← На главную
      </Link>
      <div>
        <h1 className="title-page">Матч</h1>
        <p className="lead">
          Session id: <span className="mono-inline">{sessionId}</span>
        </p>
        <p className="lead muted">
          Для короткого таймера в dev добавь в URL{" "}
          <span className="mono-inline">?discussSec=60</span> — значение должно совпадать у всех,
          кто заходит в эту же сессию. Для отладки Colyseus добавь{" "}
          <span className="mono-inline">&amp;matchDebug=1</span> (или <span className="mono-inline">?matchDebug=1</span>
          ) и пришли консоль + блок «matchDebug» ниже.
        </p>
        <p className="lead muted">
          Чтобы начать матч заново: ведущий нажимает «Завершить матч» — все вернутся в лобби, затем снова
          «Начать игру». Пока статус комнаты в БД <span className="mono-inline">playing</span>, лобби
          само перекинет обратно в игру.
        </p>
      </div>
      {isMatchHost ? (
        <div className="card card--panel">
          <p className="card__title">Ведущий</p>
          <p className="card__row muted" style={{ lineHeight: 1.5 }}>
            Завершить матч в Supabase и отключить всех от экрана игры (редирект в лобби). Colyseus-комната
            закроется, когда вкладки разорвут соединение.
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
            Ты не ведущий этой комнаты: дождись «Завершить матч» от ведущего — редирект в лобби придёт
            сам.
          </p>
        ) : (
          <p className="lead muted">
            Зайди в игру из лобби по этому коду — тогда приложение узнает твой игрок и покажет кнопку
            ведущему.
          </p>
        )
      ) : null}
      <div className="card card--panel">
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
            {status === "error" &&
              "нет соединения с game-server (часто просто не запущен Colyseus)"}
          </span>
        </p>
        {status === "error" ? (
          <p className="card__row muted" style={{ marginTop: "0.75rem", lineHeight: 1.5 }}>
            Запусти из корня репозитория:{" "}
            <span className="card__mono">npm run dev</span> (web + game-server) или отдельно{" "}
            <span className="card__mono">npm run dev:server</span>. Проверка:{" "}
            <span className="card__mono">{colyseusUrl}/health</span> должен вернуть JSON с{" "}
            <span className="card__mono">ok</span>.
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
        {stateJson ? (
          <>
            <p className="card__row">
              Фаза: <span className="card__mono">{stateJson.phase}</span>
            </p>
            <p className="card__row">
              Осталось (обсуждение):{" "}
              <span className="card__mono">
                {stateJson.phase === "discussion" ? `${remainingSec} с` : "—"}
              </span>
            </p>
            <p className="card__row">
              Игроки:{" "}
              <span className="card__mono">
                {playerList.length ? playerList.map((p) => p.nickname).join(", ") : "—"}
              </span>
            </p>
          </>
        ) : null}
        {pong ? <p className="pong-line">pong: {pong}</p> : null}
      </div>
      {readMatchDebug() && matchDebugDump ? (
        <div className="card card--panel">
          <p className="card__title">matchDebug (только при ?matchDebug=1)</p>
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
