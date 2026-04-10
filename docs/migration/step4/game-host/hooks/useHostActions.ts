'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import * as hostApi from '../api';
import { useRouteLoaderStore } from '@/store/route-loader-store';
import { ApiError } from '@/lib/api/game';
import { stashRoomPlayerForRecovery } from '@/lib/roomIdentityRecovery';

type UseHostActionsParams = {
  roomId: string | null;
  currentPlayerId: string | null;
  isHost: boolean;
  code: string;
  cancelRedirectToRoom?: () => void;
};

export function useHostActions(params: UseHostActionsParams) {
  const { roomId, currentPlayerId, isHost, code, cancelRedirectToRoom } = params;
  const router = useRouter();

  const [currentEndsAt, setCurrentEndsAt] = useState<string | null>(null);
  const [pausingGame, setPausingGame] = useState(false);
  const [hostPanelOpen, setHostPanelOpen] = useState(false);
  const [endGameConfirmOpen, setEndGameConfirmOpen] = useState(false);

  const pauseGame = useCallback(async () => {
    if (!roomId || !currentPlayerId || !isHost) return;
    setPausingGame(true);
    try {
      await hostApi.pauseGame(roomId, currentPlayerId);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Ошибка паузы');
    } finally {
      setPausingGame(false);
    }
  }, [roomId, currentPlayerId, isHost]);

  const resumeGame = useCallback(async () => {
    if (!roomId || !currentPlayerId || !isHost) return;
    try {
      await hostApi.resumeGame(roomId, currentPlayerId);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Ошибка возобновления');
    }
  }, [roomId, currentPlayerId, isHost]);

  const finishGameAndReturnToRoom = useCallback(async () => {
    if (!roomId || !currentPlayerId) return;
    try {
      const data = await hostApi.endGame(roomId, currentPlayerId);
      useRouteLoaderStore.getState().start();
      if (data.shareHash) {
        const roomCodeForStash = data.roomCode ?? code;
        if (currentPlayerId && roomCodeForStash) {
          stashRoomPlayerForRecovery(roomCodeForStash, currentPlayerId);
        }
        const roomParam = data.roomCode ? `?room=${encodeURIComponent(data.roomCode)}` : '';
        router.push(`/summary/${data.shareHash}${roomParam}`);
      } else {
        router.push(`/room/${code}`);
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Ошибка');
    }
  }, [roomId, currentPlayerId, code, router]);

  const endGame = useCallback(async () => {
    if (!roomId || !currentPlayerId) return;
    await finishGameAndReturnToRoom();
  }, [roomId, currentPlayerId, finishGameAndReturnToRoom]);

  const syncEndsAt = useCallback((endsAt: string) => {
    setCurrentEndsAt(endsAt);
  }, []);

  // ── Realtime handlers ────────────────────────────────────────

  const onGameEnded = useCallback((payload: { roomCode?: string; shareHash?: string }) => {
    cancelRedirectToRoom?.();

    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('sb-') || key.startsWith('supabase')) {
        if (!key.startsWith('player_')) {
          localStorage.removeItem(key);
        }
      }
    });

    useRouteLoaderStore.getState().start();
    if (payload.shareHash) {
      const roomCodeForStash = payload.roomCode ?? code;
      if (currentPlayerId && roomCodeForStash) {
        stashRoomPlayerForRecovery(roomCodeForStash, currentPlayerId);
      }
      const roomParam = payload.roomCode ? `?room=${encodeURIComponent(payload.roomCode)}` : '';
      router.push(`/summary/${payload.shareHash}${roomParam}`);
    } else if (payload.roomCode) {
      router.push(`/room/${payload.roomCode}`);
    }
  }, [router, cancelRedirectToRoom, currentPlayerId, code]);

  const onGameResumed = useCallback((payload: {
    endsAt: string;
    earlyVoteAvailableAt?: string | null;
    earlyVoteUsedCount?: number;
  }) => {
    setCurrentEndsAt(payload.endsAt);
  }, []);

  const realtimeHandlers = useMemo(() => ({
    onGameEnded,
    onGameResumed,
  }), [onGameEnded, onGameResumed]);

  return {
    currentEndsAt,
    pausingGame,
    hostPanelOpen,
    endGameConfirmOpen,

    setHostPanelOpen,
    setEndGameConfirmOpen,

    pauseGame,
    resumeGame,
    endGame,
    finishGameAndReturnToRoom,
    syncEndsAt,

    realtimeHandlers,
  };
}
