'use client';

import { PlayerList } from '@/features/player/components/PlayerList';
import { GameTimerTop } from '@/features/game-timer/components/GameTimerTop';
import { GameModeCard } from '@/components/game/GameModeCard';
import { GameHintButton } from '@/components/game/hint/GameHintQuestionBlock';
import { GameLocationImage } from '@/components/game/location/GameLocationImage';
import { GameSpyBlock } from '@/features/spy-guess/components/GameSpyBlock';
import { GameEarlyVoteBlock } from '@/features/early-vote/components/GameEarlyVoteBlock';
import { FooterBar } from '@/shared/components/layout/FooterBar';
import type { GameData, GamePlayer } from '@/types';
import styles from '../layout.module.css';

type GameMobileLayoutProps = {
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
  onHostPanelClick: () => void;
};

export function GameMobileLayout(props: GameMobileLayoutProps) {
  const {
    gameData, players, currentPlayerId, onlinePlayers, isHost, gameId,
    timerEndsAt, onTimeExpire, isGamePaused, remainingTimeMs,
    submitSpyGuess, submitSpyKill,
    earlyVote, earlyVoteUsedCount, earlyVoteAvailableAt,
    onHostPanelClick,
  } = props;

  const alivePlayers = players.filter((p) => p.is_alive);
  const me = players.find((p) => p.id === currentPlayerId);
  const amAlive = me ? me.is_alive !== false : gameData.isAlive;
  const showTheme = gameData.settings.mode_theme;
  const showRole = gameData.settings.mode_roles;

  return (
    <div className={styles.mobileRoot}>
      <div className={styles.mobileFixedTop}>
        <div className={`glass ${styles.mobileHeader}`}>
          <span className={styles.mobileHeaderTitle}>Игроки</span>
          <GameTimerTop
            endsAt={timerEndsAt}
            onExpire={onTimeExpire}
            isPaused={isGamePaused}
            remainingMsWhenPaused={isGamePaused ? remainingTimeMs : null}
            variant="inline"
          />
        </div>
        <div className={styles.mobilePlayerListWrap}>
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
      </div>

      <div className={styles.mobileScroll}>
        <div className={styles.mobileModes}>
          <div className={`glass ${styles.mobileModeCard}`}>
            <GameModeCard
              noGlass
              variant="theme"
              value={showTheme ? (gameData.theme || '') : ''}
            />
          </div>
          {gameData.isSpy ? (
            <div className={styles.mobileSpyBlock}>
              <GameSpyBlock
                onGuess={submitSpyGuess}
                modeHiddenThreat={!!gameData.settings.mode_hidden_threat}
                players={players}
                onEliminate={submitSpyKill}
                spyActionType={gameData.spyActionType ?? null}
                killUnlockAt={gameData.killUnlockAt ?? null}
              />
            </div>
          ) : (
            <>
              <div className={`glass ${styles.mobileModeCard}`}>
                <GameModeCard noGlass variant="location" value={gameData.locationName} />
              </div>
              <div className={`glass ${styles.mobileModeCard}`}>
                <GameModeCard
                  noGlass
                  variant="role"
                  value={showRole && gameData.myRole ? gameData.myRole : ''}
                />
              </div>
            </>
          )}
        </div>

        <div className={styles.mobileImageWrap}>
          <div className={styles.mobileImageInner}>
            <GameLocationImage imageKey={gameData.imageKey} isSpy={gameData.isSpy} />
          </div>
        </div>

        <div className={styles.mobileEarlyVote}>
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

      <FooterBar
        variant="game"
        leftSlot={<GameHintButton gameId={gameId} />}
        isHost={isHost}
        onHostPanelClick={onHostPanelClick}
      />
    </div>
  );
}
