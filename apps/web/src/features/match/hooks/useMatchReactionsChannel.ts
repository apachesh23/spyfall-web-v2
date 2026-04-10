"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { ReactionPayload } from "@/features/reactions/context";

/**
 * Тот же топик `room-${roomId}`, что и в лобби (`useLobbyRealtimeChannel`), но только broadcast реакций —
 * без postgres_changes и presence, чтобы не дублировать логику лобби на экране матча.
 */
export function useMatchReactionsChannel({
  roomId,
  playerId,
  onReaction,
}: {
  roomId: string | null;
  playerId: string | null;
  onReaction?: (payload: ReactionPayload) => void;
}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onReactionRef = useRef(onReaction);
  useEffect(() => {
    onReactionRef.current = onReaction;
  });

  useEffect(() => {
    if (!roomId || !playerId) return;

    channelRef.current = null;

    const channel = supabase.channel(`room-${roomId}`);

    channel.on("broadcast", { event: "reaction" }, ({ payload }) => {
      const p = payload as ReactionPayload;
      if (p?.playerId != null && p?.reactionId != null) {
        onReactionRef.current?.(p);
      }
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channelRef.current = channel;
      }
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId, playerId]);

  const sendReaction = useCallback(
    (reactionId: number) => {
      const ch = channelRef.current;
      if (!ch || !playerId) return;
      ch.send({
        type: "broadcast",
        event: "reaction",
        payload: { playerId, reactionId },
      });
    },
    [playerId],
  );

  return { sendReaction };
}
