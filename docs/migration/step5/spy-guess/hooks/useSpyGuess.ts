'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as spyGuessApi from '../api';
import { ApiError } from '@/lib/api/game';

type SplashEvent = {
  type: string;
  [key: string]: unknown;
} | null;

type UseSpyGuessParams = {
  roomId: string | null;
  currentPlayerId: string | null;
  gameSplashEvent: SplashEvent;
  playersCount: number;
};

export function useSpyGuess(params: UseSpyGuessParams) {
  const { roomId, currentPlayerId, gameSplashEvent, playersCount } = params;

  const [yesCount, setYesCount] = useState(0);
  const [noCount, setNoCount] = useState(0);
  const [myVote, setMyVote] = useState<'yes' | 'no' | null>(null);
  const [showSpyWinByGuess, setShowSpyWinByGuess] = useState(false);

  const splashRestoredRef = useRef(false);

  // Restore spy-win splash after F5
  useEffect(() => {
    if (!gameSplashEvent || !playersCount || splashRestoredRef.current) return;
    if (gameSplashEvent.type === 'game_over_spy_win') {
      setShowSpyWinByGuess(true);
      splashRestoredRef.current = true;
    }
  }, [gameSplashEvent, playersCount]);

  // ── Actions ──────────────────────────────────────────────────

  const submitGuess = useCallback(async (locationName: string) => {
    if (!roomId || !currentPlayerId) return;
    try {
      await spyGuessApi.submitGuess(roomId, currentPlayerId, locationName);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }, [roomId, currentPlayerId]);

  const submitKill = useCallback(async (targetId: string) => {
    if (!roomId || !currentPlayerId) return;
    try {
      await spyGuessApi.submitKill(roomId, currentPlayerId, targetId);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }, [roomId, currentPlayerId]);

  const castVote = useCallback(async (vote: 'yes' | 'no') => {
    if (!roomId || !currentPlayerId) return;
    try {
      await spyGuessApi.castSpyGuessVote(roomId, currentPlayerId, vote);
      setMyVote(vote);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }, [roomId, currentPlayerId]);

  const handleAutoWinClose = useCallback(async () => {
    if (!roomId) return;
    try {
      await spyGuessApi.ackAutoWin(roomId);
      setShowSpyWinByGuess(true);
    } catch (e) {
      console.error('Ack auto-win failed:', e);
    }
  }, [roomId]);

  // ── Realtime handlers ────────────────────────────────────────

  const onSpyGuessStarted = useCallback((_payload: { autoWin: boolean }) => {
    if (!_payload.autoWin) {
      setYesCount(0);
      setNoCount(0);
      setMyVote(null);
    }
  }, []);

  const onSpyGuessVote = useCallback((payload: { yesCount: number; noCount: number }) => {
    setYesCount(payload.yesCount);
    setNoCount(payload.noCount);
  }, []);

  const onSpyGuessFinished = useCallback((payload: { accepted: boolean }) => {
    if (payload.accepted) setShowSpyWinByGuess(true);
  }, []);

  const onSpyGuessAutoWinAcked = useCallback(() => {
    setShowSpyWinByGuess(true);
  }, []);

  const onSpyGuessVoteTimeExpired = useCallback(async () => {
    if (!roomId) return;
    try {
      await spyGuessApi.finishSpyGuess(roomId);
    } catch (e) {
      console.error('Spy guess finish failed:', e);
    }
  }, [roomId]);

  const onSpyGuessAllVoted = useCallback(() => {
    onSpyGuessVoteTimeExpired();
  }, [onSpyGuessVoteTimeExpired]);

  const realtimeHandlers = useMemo(() => ({
    onSpyGuessStarted,
    onSpyGuessVote,
    onSpyGuessFinished,
    onSpyGuessAutoWinAcked,
    onSpyGuessAllVoted,
  }), [onSpyGuessStarted, onSpyGuessVote, onSpyGuessFinished, onSpyGuessAutoWinAcked, onSpyGuessAllVoted]);

  return {
    yesCount,
    noCount,
    myVote,
    showSpyWinByGuess,

    submitGuess,
    submitKill,
    castVote,
    handleAutoWinClose,
    onSpyGuessVoteTimeExpired,

    realtimeHandlers,
  };
}
