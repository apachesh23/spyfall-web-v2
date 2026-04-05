"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { normalizeRoomSettings } from "@/lib/normalizeRoomSettings";
import { useRouteLoaderStore } from "@/store/route-loader-store";
import type { Player, Settings, SplashEventPayload, RoomStatus } from "@/types";
import { isValidAvatarId, DEFAULT_AVATAR_ID } from "@/lib/avatars";

export type ReactionPayload = { playerId: string; reactionId: number };

type UseLobbyRealtimeChannelProps = {
  roomId: string | null;
  code: string;
  playerId: string | null;
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setOnlinePlayers: React.Dispatch<React.SetStateAction<Set<string>>>;
  setRoomStatus?: React.Dispatch<React.SetStateAction<RoomStatus | null>>;
  setSplashEvent?: React.Dispatch<React.SetStateAction<SplashEventPayload | null>>;
  onReaction?: (payload: ReactionPayload) => void;
};

export function useLobbyRealtimeChannel({
  roomId,
  code,
  playerId,
  setPlayers,
  setSettings,
  setOnlinePlayers,
  setRoomStatus,
  setSplashEvent,
  onReaction,
}: UseLobbyRealtimeChannelProps) {
  const router = useRouter();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onReactionRef = useRef(onReaction);
  useEffect(() => {
    onReactionRef.current = onReaction;
  });

  useEffect(() => {
    if (!roomId || !playerId) return;

    channelRef.current = null;

    const channel = supabase.channel(`room-${roomId}`, {
      config: {
        presence: {
          key: playerId,
        },
      },
    });

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "players",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = payload.new as any;

        const newPlayer: Player = {
          ...raw,
          avatar_id: isValidAvatarId(raw.avatar_id) ? raw.avatar_id : DEFAULT_AVATAR_ID,
          joined_at: raw.joined_at ?? new Date().toISOString(),
        };

        setPlayers((prev) => {
          if (prev.some((p) => p.id === newPlayer.id)) {
            return prev;
          }
          const updated = [...prev, newPlayer];
          return updated.sort(
            (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
          );
        });
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "players",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const deletedId = (payload.old as { id: string }).id;

        if (deletedId === playerId) {
          localStorage.removeItem(`player_${code}`);
          router.push(`/invite/${code}`);
          return;
        }

        setPlayers((prev) => prev.filter((p) => p.id !== deletedId));
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        const newRoom = payload.new as Record<string, unknown>;
        const oldRoom = payload.old as Record<string, unknown>;

        if (newRoom.status !== oldRoom.status) {
          setRoomStatus?.((newRoom.status as RoomStatus) ?? null);
        }

        if (JSON.stringify(newRoom.settings) !== JSON.stringify(oldRoom.settings)) {
          setSettings(normalizeRoomSettings(newRoom.settings));
        }

        if (newRoom.splash_event !== oldRoom.splash_event) {
          setSplashEvent?.((newRoom.splash_event as SplashEventPayload | null) ?? null);
        }

        if (newRoom.status === "playing" && oldRoom.status !== "playing") {
          const hasStartSplash =
            (newRoom.splash_event as SplashEventPayload | null)?.type === "system_start";
          if (!hasStartSplash) {
            useRouteLoaderStore.getState().start();
            router.push(`/play/${code}`);
          }
        }

        if (
          newRoom.status === "playing" &&
          (oldRoom.splash_event as SplashEventPayload | null)?.type === "system_start" &&
          !newRoom.splash_event
        ) {
          useRouteLoaderStore.getState().start();
          router.push(`/play/${code}`);
        }
      },
    );

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
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    });

    channel.on("broadcast", { event: "reaction" }, ({ payload }) => {
      const p = payload as ReactionPayload;
      if (p?.playerId != null && p?.reactionId != null) {
        onReactionRef.current?.(p);
      }
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        channelRef.current = channel;
        if (playerId) {
          await channel.track({
            player_id: playerId,
            online_at: new Date().toISOString(),
          });
        }
      }
    });

    return () => {
      channelRef.current = null;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [
    roomId,
    playerId,
    code,
    setPlayers,
    setSettings,
    setOnlinePlayers,
    setRoomStatus,
    setSplashEvent,
    router,
  ]);

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
