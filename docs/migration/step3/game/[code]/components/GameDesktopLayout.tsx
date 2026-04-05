'use client';

import { PlayerList } from '@/features/player/components/PlayerList';
import { GameTimerTop } from '@/features/game-timer/components/GameTimerTop';
import { GameModeCard } from '@/components/game/GameModeCard';
import { GameHintQuestionBlock } from '@/components/game/hint/GameHintQuestionBlock';
import { GameLocationImage } from '@/components/game/location/GameLocationImage';
import { GameSpyBlock } from '@/features/spy-guess/components/GameSpyBlock';
import { GameEarlyVoteBlock } from '@/features/early-vote/components/GameEarlyVoteBlock';
import { GameHostButtons } from '@/features/game-host/components/GameHostButtons';
import type { GameData, GamePlayer } from '@/types';
import styles from '../layout.module.css';

type GameDesktopLayoutProps = {
  gameData: GameData;
  players: GamePlayer[];
  currentPlayerId: string | null;
  onlinePlayers: Set<string>;
  isHost: boolean;
  gameId: string | null;
  timerEndsAt: string;
  onTimeExpire: () => void;
  isGamePaused: boolean;
  remainingTimeMs: number | null;
  submitSpyGuess: (locationName: string) => Promise<void>;
  submitSpyKill: (targetId: string) => Promise<void>;
  earlyVote: {
    wantsEarlyVote: boolean;
    earlyVoteCount: number;
    togglingVote: boolean;
    toggleEarlyVote: () => void;
  };
  earlyVoteUsedCount: number;
  earlyVoteAvailableAt: string | null;
  pauseGame: () => void;
  endGame: () => void;
  pausingGame: boolean;
};

export function GameDesktopLayout(props: GameDesktopLayoutProps) {
  const {
    gameData, players, currentPlayerId, onlinePlayers, isHost, gameId,
    timerEndsAt, onTimeExpire, isGamePaused, remainingTimeMs,
    submitSpyGuess, submitSpyKill,
    earlyVote, earlyVoteUsedCount, earlyVoteAvailableAt,
    pauseGame, endGame, pausingGame,
  } = props;

  const alivePlayers = players.filter((p) => p.is_alive);
  const me = players.find((p) => p.id === currentPlayerId);
  const amAlive = me ? me.is_alive !== false : gameData.isAlive;
  const showTheme = gameData.settings.mode_theme;
  const showRole = gameData.settings.mode_roles;

  return (
    <div className={styles.contentGrid}>
      <div className={styles.leftCol}>
        <div className={`glass ${styles.glassBlock} ${styles.glassBlockCard}`}>
          <GameModeCard
            noGlass
            variant="theme"
            value={showTheme ? (gameData.theme || '') : ''}
          />
        </div>
        <div className={styles.playerListWrap}>
          <PlayerList
            layout="game"
            players={players}
            currentPlayerId={currentPlayerId}
            onlinePlayers={onlinePlayers}
            isHost={false}
            eliminatedPlayerIds={new Set(
              players.filter((p) => p.is_alive === false).map((p) => p.id),
            )}
          />
        </div>
        <div className={styles.timerWrap}>
          <GameHintQuestionBlock gameId={gameId} />
        </div>
      </div>

      <div className={styles.rightCol}>
        <div
          className={`${styles.modeCardsRow} ${gameData.isSpy ? styles.modeCardsRowSingle : ''}`}
        >
          {gameData.isSpy ? (
            <GameSpyBlock
              onGuess={submitSpyGuess}
              modeHiddenThreat={!!gameData.settings.mode_hidden_threat}
              players={players}
              onEliminate={submitSpyKill}
              spyActionType={gameData.spyActionType ?? null}
              killUnlockAt={gameData.killUnlockAt ?? null}
            />
          ) : (
            <>
              <GameModeCard variant="location" value={gameData.locationName} />
              <GameModeCard
                variant="role"
                value={showRole && gameData.myRole ? gameData.myRole : ''}
              />
            </>
          )}
        </div>
        <div className={styles.imagePlaceholderWrap}>
          <GameTimerTop
            endsAt={timerEndsAt}
            onExpire={onTimeExpire}
            isPaused={isGamePaused}
            remainingMsWhenPaused={isGamePaused ? remainingTimeMs : null}
          />
          <GameLocationImage imageKey={gameData.imageKey} isSpy={gameData.isSpy} />
        </div>
        <div className={styles.earlyVoteWrap}>
          <GameEarlyVoteBlock
            isActive={earlyVote.wantsEarlyVote}
            onToggle={earlyVote.toggleEarlyVote}
            disabled={earlyVote.togglingVote || !amAlive}
            current={earlyVote.earlyVoteCount}
            total={alivePlayers.length}
            spectator={!amAlive}
            usedCount={earlyVoteUsedCount}
            availableAt={earlyVoteAvailableAt}
            isGamePaused={isGamePaused}
          />
        </div>
      </div>

      {isHost && (
        <GameHostButtons
          onPause={pauseGame}
          onEndGame={endGame}
          isPaused={isGamePaused}
          pausingGame={pausingGame}
        />
      )}
    </div>
  );
}
