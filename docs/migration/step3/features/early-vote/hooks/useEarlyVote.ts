'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { GamePlayer } from '@/types';
import * as earlyVoteApi from '../api';
import { ApiError } from '@/lib/api/game';

type UseEarlyVoteParams = {
  roomId: string | null;
  currentPlayerId: string | null;
  players: GamePlayer[];
  myWantsEarlyVote: boolean;
  initialUsedCount: number;
  initialAvailableAt: string | null;
};

export function useEarlyVote(params: UseEarlyVoteParams) {
  const { roomId, currentPlayerId, players, myWantsEarlyVote, initialUsedCount, initialAvailableAt } = params;

  const [wantsEarlyVote, setWantsEarlyVote] = useState(false);
  const [earlyVoteCount, setEarlyVoteCount] = useState(0);
  const [togglingVote, setTogglingVote] = useState(false);
  const [usedCount, setUsedCount] = useState(initialUsedCount);
  const [availableAt, setAvailableAt] = useState<string | null>(initialAvailableAt);

  // Первый рендер идёт до loadGame(): initial* ещё 0/null — после загрузки родитель обновляет пропсы.
  useEffect(() => {
    setUsedCount(initialUsedCount);
    setAvailableAt(initialAvailableAt);
  }, [initialUsedCount, initialAvailableAt]);

  useEffect(() => {
    setWantsEarlyVote(myWantsEarlyVote);
    const count = players.filter(p => p.is_alive && p.wants_early_vote).length;
    setEarlyVoteCount(count);
  }, [myWantsEarlyVote, players]);

  const toggleEarlyVote = useCallback(async () => {
    if (!roomId || !currentPlayerId) return;
    setTogglingVote(true);
    try {
      await earlyVoteApi.toggleEarlyVote(roomId, currentPlayerId);
    } catch (e) {
      if (e instanceof ApiError && e.status === 408) {
        console.debug(
          'Early vote toggle: request timed out (сервер мог успеть обновить БД; смотри realtime).',
        );
        return;
      }
      if (e instanceof ApiError) {
        alert(e.message || 'Ошибка');
      } else {
        alert('Ошибка');
      }
    } finally {
      setTogglingVote(false);
    }
  }, [roomId, currentPlayerId]);

  const reset = useCallback(() => {
    setWantsEarlyVote(false);
    setEarlyVoteCount(0);
  }, []);

  /** Сервер — источник истины (broadcast / loadGame); чинит пропуски voting_started. */
  const syncUsedCountFromServer = useCallback((count: number) => {
    setUsedCount(count);
  }, []);

  const updateAvailableAt = useCallback((value: string | null) => {
    setAvailableAt(value);
  }, []);

  // ── Realtime handler ─────────────────────────────────────────

  const onEarlyVoteUpdate = useCallback(
    (data: { playerId: string; wantsVote: boolean; totalVotes: number }) => {
      setEarlyVoteCount(data.totalVotes);
      if (data.playerId === currentPlayerId) {
        setWantsEarlyVote(data.wantsVote);
      }
    },
    [currentPlayerId],
  );

  const realtimeHandlers = useMemo(() => ({
    onEarlyVoteUpdate,
  }), [onEarlyVoteUpdate]);

  return {
    wantsEarlyVote,
    earlyVoteCount,
    togglingVote,
    usedCount,
    availableAt,

    toggleEarlyVote,
    reset,
    syncUsedCountFromServer,
    updateAvailableAt,

    realtimeHandlers,
  };
}
