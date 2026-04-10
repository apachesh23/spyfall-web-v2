'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { VotingSplash, votingSplashStyles } from './VotingSplash';
import { VotingCard } from './VotingCard';
import { playUI } from '@/lib/sound';
import type { GamePlayer } from '@/types';
import type { VotingState } from '../types';

type VotingOverlayProps = {
  state: VotingState;
  votingSessionActive: boolean;
  kickedSplashKey: string | null;
  players: GamePlayer[];
  currentPlayerId: string | null;
  isAlive: boolean;
  castVote: (suspectId: string) => void;
  castSkip: () => void;
  setSelectedTarget: (id: string | null) => void;
  onVotingTimeExpired: () => void;
};

export function VotingOverlay(props: VotingOverlayProps) {
  const {
    state, votingSessionActive,
    players, currentPlayerId, isAlive,
    castVote, castSkip, setSelectedTarget,
    onVotingTimeExpired,
  } = props;

  const alivePlayers = players.filter((p) => p.is_alive);
  const isRevote = state.phase === 'revote';
  const showCountdownTimer =
    state.phase === 'collecting' || state.phase === 'revote';

  const splashKey = `v-${state.phase}-${state.votingType}-${state.endsAt ?? 'e'}-${state.resultEndsAt ?? 're'}-${state.result?.type ?? 'x'}`;

  return (
    <>
      <AnimatePresence mode="wait">
        {votingSessionActive && (
          <VotingSplash
            key={splashKey}
            title={state.votingType === 'final' ? 'Кто шпион?' : 'Голосование'}
            titleBadge={isRevote ? 'РАУНД 2' : undefined}
            countdownLabel="ОСТАЛОСЬ..."
            colors={state.votingType === 'final' ? { front: '#E8955C', back: '#C4783D' } : undefined}
            endsAt={showCountdownTimer ? (state.endsAt ?? undefined) : undefined}
            /** Без этого VotingSplash берёт DEFAULT_COUNTDOWN 60 и тикает onClose на экране результата. */
            countdownSeconds={showCountdownTimer ? undefined : 0}
            onClose={onVotingTimeExpired}
            resultCountdown={
              (state.phase === 'result_no_vote' || state.phase === 'revote_result_no_vote' || state.phase === 'result_tie')
                ? state.resultCountdown
                : undefined
            }
            resultCountdownLabel={
              state.phase === 'result_no_vote' || state.phase === 'revote_result_no_vote'
                ? 'Игра продолжается...'
                : state.phase === 'result_tie'
                  ? 'Продолжение..'
                  : undefined
            }
          >
            <VotingContent
              state={state}
              players={players}
              alivePlayers={alivePlayers}
              currentPlayerId={currentPlayerId}
              isAlive={isAlive}
              castVote={castVote}
              castSkip={castSkip}
              setSelectedTarget={setSelectedTarget}
            />
          </VotingSplash>
        )}
      </AnimatePresence>
    </>
  );
}

type VotingContentProps = {
  state: VotingState;
  players: GamePlayer[];
  alivePlayers: GamePlayer[];
  currentPlayerId: string | null;
  isAlive: boolean;
  castVote: (suspectId: string) => void;
  castSkip: () => void;
  setSelectedTarget: (id: string | null) => void;
};

function VotingContent(props: VotingContentProps) {
  const {
    state, players, alivePlayers, currentPlayerId, isAlive,
    castVote, castSkip, setSelectedTarget,
  } = props;

  const isSpectator = !isAlive;
  const isRevote = state.phase === 'revote';
  const displayPlayers = alivePlayers;
  const candidateIds = isRevote ? state.revoteCandidates : null;
  const isCandidate = isRevote && currentPlayerId && state.revoteCandidates.includes(currentPlayerId);
  const hasVoted = state.myVote !== null || state.mySkipped || (isRevote && !!isCandidate);
  const aliveIdSet = new Set(alivePlayers.map((p) => p.id));
  const votedAmongAlive = [...state.votedPlayers].filter((id) => aliveIdSet.has(id)).length;
  const votedCountDisplay =
    isRevote && state.revoteCandidates?.length
      ? new Set([
          ...[...state.votedPlayers].filter((id) => aliveIdSet.has(id)),
          ...state.revoteCandidates.filter((id) => aliveIdSet.has(id)),
        ]).size
      : votedAmongAlive;

  if (
    (state.phase === 'result_no_vote' || state.phase === 'revote_result_no_vote') &&
    state.votingType !== 'final'
  ) {
    return (
      <div className={votingSplashStyles.votingCenter}>
        <p className={votingSplashStyles.votingNoResult}>Голосование не состоялось</p>
      </div>
    );
  }

  if (state.phase === 'result_tie' && state.result?.candidates) {
    const voteCounts = (state.result.voteCounts ?? {}) as Record<string, number>;
    const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
    type TieRow = { player: GamePlayer; percent: number };
    const two = state.result.candidates
      .slice(0, 2)
      .map((id: string) => {
        const p = players.find((pl) => pl.id === id);
        const votes = totalVotes > 0 ? (voteCounts[id] ?? 0) : 0;
        const percent = totalVotes > 0 ? Math.round((100 * votes) / totalVotes) : 0;
        return p ? { player: p, percent } : null;
      })
      .filter((x): x is TieRow => x != null);
    return (
      <div className={votingSplashStyles.votingCenter}>
        <p className={votingSplashStyles.votingMostVotes}>Кандидаты на повторное голосование</p>
        <div className={votingSplashStyles.votingResultTwo}>
          {two.map(({ player, percent }) => (
            <VotingCard
              key={player.id}
              player={player}
              isMe={player.id === currentPlayerId}
              isHost={!!player.is_host}
              hasVoted={false}
              selected={false}
              disabled
              onSelect={() => {}}
              percentLabel={`${percent}%`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={votingSplashStyles.votingCenter}>
      {isSpectator && (
        <p className={votingSplashStyles.votingSpectator}>Вы изгнаны. Наблюдаете за голосованием.</p>
      )}
      <div className={votingSplashStyles.votingList}>
        {displayPlayers.map((player) => {
          const isSelf = player.id === currentPlayerId;
          const dimmed = isSelf || (isRevote && candidateIds != null && !candidateIds.includes(player.id));
          const disabled = dimmed || hasVoted || (!!isCandidate && isSelf) || isSpectator;
          return (
            <VotingCard
              key={player.id}
              player={player}
              isMe={isSelf}
              isHost={!!player.is_host}
              hasVoted={state.votedPlayers.has(player.id) || (isRevote && state.revoteCandidates.includes(player.id))}
              selected={!isSelf && state.selectedTarget === player.id}
              disabled={disabled}
              onSelect={() => !disabled && !isSelf && setSelectedTarget(state.selectedTarget === player.id ? null : player.id)}
              dimmed={dimmed}
            />
          );
        })}
      </div>
      {isSpectator ? (
        <p className={votingSplashStyles.votingDone}>
          Проголосовало: {votedCountDisplay} / {displayPlayers.length}
        </p>
      ) : hasVoted ? (
        <p className={votingSplashStyles.votingDone}>
          Голос учтён. Проголосовало: {votedCountDisplay} / {displayPlayers.length}
        </p>
      ) : (
        <div className={votingSplashStyles.votingActions}>
          {state.votingType !== 'final' && (
            <motion.button
              type="button"
              className={`glass glass-hover ${votingSplashStyles.skipBtn}`}
              onClick={() => { playUI('click'); castSkip(); }}
              onMouseEnter={() => playUI('hover')}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.08 }}
            >
              ПРОПУСТИТЬ
            </motion.button>
          )}
          <motion.button
            type="button"
            className={votingSplashStyles.voteBtn}
            onClick={() => {
              if (state.selectedTarget) {
                playUI('click');
                castVote(state.selectedTarget);
              }
            }}
            onMouseEnter={() => playUI('hover')}
            disabled={!state.selectedTarget || (isRevote && !!state.selectedTarget && !state.revoteCandidates.includes(state.selectedTarget))}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.08 }}
          >
            ПРОГОЛОСОВАТЬ
          </motion.button>
        </div>
      )}
    </div>
  );
}
