'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { use } from 'react';
import { useGameData, type VotingPostgresBridge } from '@/hooks/game/useGameData';
import { useGameRealtime } from '@/hooks/game/useGameRealtime';
import { useVotingMachine } from '@/features/voting/hooks/useVotingMachine';
import { useSpyGuess } from '@/features/spy-guess/hooks/useSpyGuess';
import { useEarlyVote } from '@/features/early-vote/hooks/useEarlyVote';
import { useHostActions } from '@/features/game-host/hooks/useHostActions';
import { useGameMusic } from '@/features/game-music/hooks/useGameMusic';
import { useReactions } from '@/features/reactions/context';
import { useRouteLoaderStore } from '@/store/route-loader-store';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { FullscreenLoader } from '@/shared/components/layout/FullscreenLoader';
import { GameDesktopLayout } from './components/GameDesktopLayout';
import { GameMobileLayout } from './components/GameMobileLayout';
import { VotingOverlay } from '@/features/voting/components/VotingOverlay';
import { SpyGuessOverlay } from '@/features/spy-guess/components/SpyGuessOverlay';
import { GameSplashes } from './components/GameSplashes';
import { GameDebugEndGame } from './components/GameDebugEndGame';
import type { VotingStartedSideEffectsPayload } from '@/features/voting/types';
import styles from './layout.module.css';

export default function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);

  const votingPgRef = useRef<VotingPostgresBridge | null>(null);
  const game = useGameData(code, votingPgRef);
  const {
    loading, gameData, players, currentPlayerId, isHost, roomId, gameId,
    applyLocalPlayerElimination,
    applyVotingTimerPause,
    clearVotingTimerPause,
    gameSplashEvent, isGamePaused, remainingTimeMs,
    votingStatus, votingPhase: serverVotingPhase,
    spyGuessText, spyGuessStatus, spyGuessEndsAt,
    earlyVoteUsedCount, earlyVoteAvailableAt,
    myWantsEarlyVote, cancelRedirectToRoom,
    gamePhase, applyVotingStartedRealtime, applyVotingFinishedGameSync,
  } = game;

  const earlyVote = useEarlyVote({
    roomId, currentPlayerId, players, myWantsEarlyVote,
    initialUsedCount: earlyVoteUsedCount,
    initialAvailableAt: earlyVoteAvailableAt,
  });

  const applyVotingStartedSideEffects = useCallback(
    (payload: VotingStartedSideEffectsPayload) => {
      applyVotingStartedRealtime({
        endsAt: payload.endsAt,
        sessionId: payload.sessionId,
      });
      earlyVote.reset();
      if (typeof payload.earlyVoteUsedCount === 'number') {
        earlyVote.syncUsedCountFromServer(payload.earlyVoteUsedCount);
      }
      if (payload.earlyVoteAvailableAt !== undefined) {
        earlyVote.updateAvailableAt(payload.earlyVoteAvailableAt ?? null);
      }
      if (typeof payload.gameRemainingMs === 'number') {
        applyVotingTimerPause(payload.gameRemainingMs);
      }
    },
    [earlyVote, applyVotingTimerPause, applyVotingStartedRealtime],
  );

  const applyVotingFinishedSideEffects = useCallback(
    (payload: { earlyVoteUsedCount?: number; earlyVoteAvailableAt?: string | null }) => {
      if (typeof payload.earlyVoteUsedCount === 'number') {
        earlyVote.syncUsedCountFromServer(payload.earlyVoteUsedCount);
      }
      if (payload.earlyVoteAvailableAt !== undefined) {
        earlyVote.updateAvailableAt(payload.earlyVoteAvailableAt ?? null);
      }
    },
    [earlyVote],
  );

  const voting = useVotingMachine({
    roomId, currentPlayerId, players,
    gamePhase,
    gameTimerEndsAt: gameData?.endsAt ?? null,
    votingStatus,
    gameSplashEvent,
    onNonFinalElimination: earlyVote.reset,
    applyVotingStartedSideEffects,
    applyVotingFinishedSideEffects,
    applyVotingFinishedGameSync,
  });

  votingPgRef.current = {
    onVotingState: voting.realtimeHandlers.onVotingState,
    applyVotingStartedFromGameRow: applyVotingStartedSideEffects,
  };

  const spyGuess = useSpyGuess({
    roomId, currentPlayerId, gameSplashEvent, playersCount: players.length,
  });

  const host = useHostActions({
    roomId, currentPlayerId, isHost, code, cancelRedirectToRoom,
  });

  const isGameOverSplash =
    (voting.state.result && voting.state.showFinalResult) || spyGuess.showSpyWinByGuess;

  useGameMusic({
    votingSessionActive: voting.votingSessionActive,
    isGameOverSplash: !!isGameOverSplash,
    serverVotingPhase,
  });

  // Sync timer endsAt from initial game data
  useEffect(() => {
    if (gameData?.endsAt) host.syncEndsAt(gameData.endsAt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameData?.endsAt]);

  // ── Realtime ──────────────────────────────────────────────────

  const [onlinePlayers, setOnlinePlayers] = useState<Set<string>>(new Set());
  const reactions = useReactions();

  const { sendReaction } = useGameRealtime({
    roomId,
    playerId: currentPlayerId,
    onOnlinePlayersChange: setOnlinePlayers,
    onReconnect: voting.handleReconnect,
    onEarlyVoteUpdate: earlyVote.realtimeHandlers.onEarlyVoteUpdate,
    onGamePaused: (p) => {
      if (typeof p?.remainingTimeMs === 'number') {
        applyVotingTimerPause(p.remainingTimeMs);
      }
    },
    ...host.realtimeHandlers,
    onGameResumed: (payload) => {
      clearVotingTimerPause();
      host.realtimeHandlers.onGameResumed(payload);
      if (typeof payload.earlyVoteUsedCount === 'number') {
        earlyVote.syncUsedCountFromServer(payload.earlyVoteUsedCount);
      }
      if (payload.earlyVoteAvailableAt !== undefined) {
        earlyVote.updateAvailableAt(payload.earlyVoteAvailableAt ?? null);
      }
    },
    ...spyGuess.realtimeHandlers,
    onPlayerEliminated: (payload: { playerId: string; deathReason: 'voted' | 'killed' }) => {
      applyLocalPlayerElimination(payload.playerId, payload.deathReason);
    },
    onReaction: (payload) => reactions?.addReaction(payload),
  });

  const sendReactionRef = useRef(sendReaction);
  sendReactionRef.current = sendReaction;

  const sendReactionWithSelf = useCallback(
    (reactionId: number) => {
      if (currentPlayerId) reactions?.addReaction({ playerId: currentPlayerId, reactionId });
      sendReactionRef.current(reactionId);
    },
    [currentPlayerId, reactions],
  );

  useEffect(() => {
    reactions?.registerSendReaction(sendReactionWithSelf);
    return () => reactions?.registerSendReaction(() => {});
  }, [reactions, sendReactionWithSelf]);

  // ── Loader ────────────────────────────────────────────────────

  const stopGlobalLoader = useRouteLoaderStore((s) => s.stop);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    if (loading) return;
    stopGlobalLoader();
    const timeout = setTimeout(() => setShowLoader(false), 800);
    return () => clearTimeout(timeout);
  }, [loading, stopGlobalLoader]);

  const isMobile = useMediaQuery('(max-width: 1270px)');

  // ── Render ────────────────────────────────────────────────────

  if (loading) return <FullscreenLoader show={true} />;

  if (!gameData) {
    return (
      <>
        <FullscreenLoader show={false} />
        <div className={styles.loadingWrap}>
          <p className={styles.loadingText}>Ошибка загрузки</p>
        </div>
      </>
    );
  }

  const timerEndsAt = host.currentEndsAt || gameData.endsAt;
  const alivePlayers = players.filter((p) => p.is_alive);

  const layoutProps = {
    gameData, players, currentPlayerId, onlinePlayers, isHost, gameId,
    timerEndsAt, onTimeExpire: voting.handleTimeExpire,
    isGamePaused, remainingTimeMs,
    submitSpyGuess: spyGuess.submitGuess,
    submitSpyKill: spyGuess.submitKill,
    earlyVote, earlyVoteUsedCount: earlyVote.usedCount, earlyVoteAvailableAt: earlyVote.availableAt,
  } as const;

  return (
    <>
      <FullscreenLoader show={showLoader} />

      {isMobile
        ? <GameMobileLayout {...layoutProps} onHostPanelClick={() => host.setHostPanelOpen(true)} />
        : <GameDesktopLayout {...layoutProps} pauseGame={host.pauseGame} endGame={host.endGame} pausingGame={host.pausingGame} />
      }

      <VotingOverlay
        state={voting.state}
        votingSessionActive={voting.votingSessionActive}
        kickedSplashKey={voting.kickedSplashKey}
        players={players}
        currentPlayerId={currentPlayerId}
        isAlive={gameData.isAlive}
        castVote={voting.castVote}
        castSkip={voting.castSkip}
        setSelectedTarget={voting.setSelectedTarget}
        onVotingTimeExpired={voting.onVotingTimeExpired}
      />

      <SpyGuessOverlay
        spyGuessStatus={spyGuessStatus}
        spyGuessText={spyGuessText}
        spyGuessEndsAt={spyGuessEndsAt}
        isSpy={gameData.isSpy}
        alivePlayers={alivePlayers}
        spyGuess={spyGuess}
      />

      <GameSplashes
        gameData={gameData}
        players={players}
        roomId={roomId}
        isHost={isHost}
        isGamePaused={isGamePaused}
        gameSplashEvent={gameSplashEvent}
        votingState={voting.state}
        kickedSplashKey={voting.kickedSplashKey}
        showSpyWinByGuess={spyGuess.showSpyWinByGuess}
        resumeGame={host.resumeGame}
        finishGameAndReturnToRoom={host.finishGameAndReturnToRoom}
        handleIntermediateResultClose={voting.handleIntermediateResultClose}
        hostPanelOpen={host.hostPanelOpen}
        setHostPanelOpen={host.setHostPanelOpen}
        endGameConfirmOpen={host.endGameConfirmOpen}
        setEndGameConfirmOpen={host.setEndGameConfirmOpen}
        pauseGame={host.pauseGame}
        endGame={host.endGame}
        pausingGame={host.pausingGame}
      />

      <GameDebugEndGame
        isHost={isHost}
        finishGameAndReturnToRoom={host.finishGameAndReturnToRoom}
      />
    </>
  );
}
