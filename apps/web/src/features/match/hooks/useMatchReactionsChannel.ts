"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { ReactionPayload } from "@/features/reactions/context";

/**
 * Один канал `room-${roomId}`: broadcast реакций + **presence** (индикатор ONLINE), как в лобби.
 * Раньше на /play в PlayerList передавали «все из Colyseus = онлайн» — без Realtime presence это неверно.
 *
 * Отложенная подписка и повторы — см. гонку с removeChannel лобби при client-nav (iOS Safari).
 */
const FIRST_SUBSCRIBE_DEFER_MS = 52;
const SUBSCRIBE_ATTEMPTS = 6;

export function useMatchReactionsChannel({
  roomId,
  playerId,
  onReaction,
  setOnlinePlayers,
}: {
  roomId: string | null;
  playerId: string | null;
  onReaction?: (payload: ReactionPayload) => void;
  setOnlinePlayers: Dispatch<SetStateAction<Set<string>>>;
}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onReactionRef = useRef(onReaction);
  useEffect(() => {
    onReactionRef.current = onReaction;
  });

  useEffect(() => {
    if (!roomId || !playerId) return;

    let cancelled = false;
    let deferTimer: number | null = null;
    let retryTimer: number | null = null;
    let activeChannel: RealtimeChannel | null = null;
    let initialDeferPending = true;

    const removeChannel = (ch: RealtimeChannel | null) => {
      if (!ch) return;
      try {
        void supabase.removeChannel(ch);
      } catch {
        /* ignore */
      }
    };

    const attemptSubscribe = (attempt: number) => {
      if (cancelled) return;

      if (activeChannel) {
        channelRef.current = null;
        removeChannel(activeChannel);
        activeChannel = null;
      }

      const channel = supabase.channel(`room-${roomId}`, {
        config: {
          presence: {
            key: playerId,
          },
        },
      });
      activeChannel = channel;

      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const online = new Set<string>();
        Object.keys(state).forEach((key) => {
          online.add(key);
        });
        setOnlinePlayers(online);
      });

      channel.on("presence", { event: "join" }, ({ key }) => {
        setOnlinePlayers((prev) => new Set([...prev, key]));
      });

      channel.on("presence", { event: "leave" }, ({ key }) => {
        setOnlinePlayers((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      });

      channel.on("broadcast", { event: "reaction" }, ({ payload }) => {
        const p = payload as ReactionPayload;
        if (p?.playerId != null && p?.reactionId != null) {
          onReactionRef.current?.(p);
        }
      });

      channel.subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          channelRef.current = channel;
          void channel.track({
            player_id: playerId,
            online_at: new Date().toISOString(),
          });
          return;
        }
        if (
          (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") &&
          attempt < SUBSCRIBE_ATTEMPTS - 1
        ) {
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            attemptSubscribe(attempt + 1);
          }, 220 * (attempt + 1));
        }
      });
    };

    deferTimer = window.setTimeout(() => {
      deferTimer = null;
      initialDeferPending = false;
      attemptSubscribe(0);
    }, FIRST_SUBSCRIBE_DEFER_MS);

    const onNetOnline = () => {
      if (cancelled || initialDeferPending || channelRef.current) return;
      attemptSubscribe(0);
    };

    const onVisible = () => {
      if (
        cancelled ||
        initialDeferPending ||
        document.visibilityState !== "visible" ||
        channelRef.current
      ) {
        return;
      }
      window.setTimeout(() => {
        if (!cancelled && !initialDeferPending && !channelRef.current) {
          attemptSubscribe(0);
        }
      }, 120);
    };

    window.addEventListener("online", onNetOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (deferTimer) clearTimeout(deferTimer);
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("online", onNetOnline);
      document.removeEventListener("visibilitychange", onVisible);
      channelRef.current = null;
      removeChannel(activeChannel);
      activeChannel = null;
      setOnlinePlayers(new Set());
    };
  }, [roomId, playerId, setOnlinePlayers]);

  const sendReaction = useCallback(
    (reactionId: number) => {
      const ch = channelRef.current;
      if (!ch || !playerId) return;
      void ch.send({
        type: "broadcast",
        event: "reaction",
        payload: { playerId, reactionId },
      });
    },
    [playerId],
  );

  return { sendReaction };
}
