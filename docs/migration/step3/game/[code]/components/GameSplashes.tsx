'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { SplashScreen } from '@/features/splash-screen';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { playUI } from '@/lib/sound';
import { clearSplash } from '@/features/game-host/api';
import type { GameData, GamePlayer } from '@/types';
import type { VotingState, VotingResult } from '@/features/voting/types';
import styles from '../layout.module.css';

type SplashEvent = {
  type: string;
  at?: string;
  ends_at?: string;
  countdownSeconds?: number;
  countdownLabel?: string;
  target_id?: string;
  eliminatedId?: string;
  wasSpy?: boolean;
  winner?: string;
  voteCounts?: Record<string, number>;
  [key: string]: unknown;
} | null;

type GameSplashesProps = {
  gameData: GameData;
  players: GamePlayer[];
  roomId: string | null;
  isHost: boolean;
  isGamePaused: boolean;
  gameSplashEvent: SplashEvent;
  votingState: VotingState;
  kickedSplashKey: string | null;
  showSpyWinByGuess: boolean;
  resumeGame: () => void;
  finishGameAndReturnToRoom: () => void;
  handleIntermediateResultClose: () => void;
  hostPanelOpen: boolean;
  setHostPanelOpen: (v: boolean) => void;
  endGameConfirmOpen: boolean;
  setEndGameConfirmOpen: (v: boolean) => void;
  pauseGame: () => void;
  endGame: () => void;
  pausingGame: boolean;
};

export function GameSplashes(props: GameSplashesProps) {
  const {
    gameData, players, roomId, isHost, gameSplashEvent,
    votingState, kickedSplashKey, showSpyWinByGuess,
    resumeGame, finishGameAndReturnToRoom, handleIntermediateResultClose,
    hostPanelOpen, setHostPanelOpen,
    endGameConfirmOpen, setEndGameConfirmOpen,
    pauseGame, endGame, isGamePaused, pausingGame,
  } = props;

  return (
    <>
      <AnimatePresence>
        {gameSplashEvent?.type === 'system_pause' && (
          <SplashScreen
            key="system_pause"
            type="system_pause"
            showContinueButton={isHost}
            onClose={resumeGame}
          />
        )}

        {gameSplashEvent?.type === 'spy_kill' && (() => {
          const targetId = gameSplashEvent.target_id;
          const killed = targetId ? players.find((p) => p.id === targetId) : null;
          return (
            <SplashScreen
              key="spy_kill"
              type="spy_kill"
              countdownSeconds={gameSplashEvent.countdownSeconds ?? 5}
              countdownLabel={gameSplashEvent.countdownLabel ?? 'Игра продолжается'}
              eventAt={gameSplashEvent.at}
              endsAt={gameSplashEvent.ends_at}
              eliminatedPlayer={killed ? { nickname: killed.nickname, avatar_id: killed.avatar_id, role: killed.role ?? undefined } : undefined}
              onClose={async () => {
                if (roomId) {
                  try { await clearSplash(roomId); }
                  catch (e) { console.error('Splash clear failed:', e); }
                }
              }}
            />
          );
        })()}

        {votingState.result && votingState.showIntermediateResult && votingState.result.type === 'eliminated' && votingState.result.eliminatedId && (() => {
          const eliminatedId = kickedSplashKey ?? votingState.result!.eliminatedId!;
          const eliminated = players.find((p) => p.id === (votingState.result!.eliminatedId ?? eliminatedId));
          if (!eliminated) return null;
          const splashKey = `voting_eliminated_${eliminatedId}`;
          const voteCounts = (votingState.result!.voteCounts ?? {}) as Record<string, number>;
          const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
          const percent = totalVotes > 0 && votingState.result!.eliminatedId
            ? Math.round((100 * (voteCounts[votingState.result!.eliminatedId] ?? 0)) / totalVotes)
            : undefined;
          const aliveCount = players.filter((p) => p.is_alive).length;
          const stillAlive = eliminated?.is_alive === true;
          const remainingAfterExile = stillAlive ? aliveCount - 1 : aliveCount;
          const gameEnding = votingState.result!.wasSpy || remainingAfterExile < 3 || votingState.result!.isFinal;
          const countdownLabel = gameEnding ? 'Игра завершена...' : 'Игра продолжается...';
          const splashEv =
            gameSplashEvent?.type === 'voting_kicked_civilian' || gameSplashEvent?.type === 'voting_final_transition'
              ? gameSplashEvent
              : null;
          /** Считаем 10с от eventAt (at), без ends_at — иначе при рассинхроне дублируется длительность (~20с). */
          const exileEventAt = typeof splashEv?.at === 'string' ? splashEv.at : undefined;
          return (
            <SplashScreen
              key={`${splashKey}_${exileEventAt ?? 'no_at'}`}
              type="voting_kicked_civilian"
              onClose={handleIntermediateResultClose}
              countdownSeconds={10}
              countdownLabel={countdownLabel}
              eventAt={exileEventAt}
              eliminatedPlayer={{ nickname: eliminated.nickname, avatar_id: eliminated.avatar_id, role: eliminated.role ?? undefined }}
              eliminatedWasSpy={votingState.result!.wasSpy}
              eliminatedVotePercent={percent}
            />
          );
        })()}

        {votingState.result && votingState.showFinalResult &&
          (votingState.result.type === 'eliminated' && votingState.result.isFinal || votingState.result.type === 'final_civilians_lose') && (
          <SplashScreen
            key="game_over"
            type={votingState.result.winner === 'civilians' ? 'game_over_civilians_win' : 'game_over_spy_win_voting'}
            players={players}
            spyIds={gameData.spyIds}
            showContinueButton={isHost}
            onClose={finishGameAndReturnToRoom}
          />
        )}

        {showSpyWinByGuess && (
          <SplashScreen
            key="game_over_spy_guess"
            type="game_over_spy_win"
            players={players}
            spyIds={gameData.spyIds}
            showContinueButton={isHost}
            onClose={finishGameAndReturnToRoom}
          />
        )}
      </AnimatePresence>

      {/* Mobile host panel modal */}
      <AnimatePresence>
        {hostPanelOpen && isHost && (
          <motion.div
            className={styles.hostPanelBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className={styles.hostPanelCloseArea}
              onClick={() => setHostPanelOpen(false)}
              aria-hidden
            />
            <motion.div
              className={styles.hostPanelContent}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className={styles.hostPanelTitle}>ПАНЕЛЬ ВЕДУЩЕГО</h2>
              <div className={styles.hostPanelActions}>
                <button
                  type="button"
                  className={`glass glass-hover ${styles.hostPanelButton}`}
                  onMouseEnter={() => playUI('hover')}
                  onClick={() => {
                    playUI('click');
                    if (isGamePaused) { resumeGame(); } else { pauseGame(); }
                    setHostPanelOpen(false);
                  }}
                >
                  {isGamePaused ? 'Возобновить игру' : 'Пауза игры'}
                </button>
                <button
                  type="button"
                  className={`glass glass-hover ${styles.hostPanelButton}`}
                  onClick={() => {
                    playUI('click');
                    setHostPanelOpen(false);
                    setEndGameConfirmOpen(true);
                  }}
                  onMouseEnter={() => playUI('hover')}
                >
                  Завершить игру
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={endGameConfirmOpen}
        onClose={() => setEndGameConfirmOpen(false)}
        question="Вы хотите завершить игру?"
        onConfirm={() => {
          setEndGameConfirmOpen(false);
          endGame();
        }}
      />
    </>
  );
}
