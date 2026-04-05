'use client';

import { useEffect, useState } from 'react';
import { PrimaryButtonLobby } from '@/shared/components/ui/PrimaryButtonLobby';
import { LottieIcon } from '@/shared/components/ui/LottieIcon';
import { playUI } from '@/lib/sound';
import styles from './GameEarlyVoteBlock.module.css';

type GameEarlyVoteBlockProps = {
  isActive: boolean;
  onToggle: () => void;
  disabled?: boolean;
  current: number;
  total: number;
  /** Игрок изгнан — блок виден, но неактивен (прозрачность + нельзя нажать) */
  spectator?: boolean;
  /** Сколько досрочных голосований уже было запущено (0..2). */
  usedCount: number;
  /** Когда (по серверу) можно запускать следующее досрочное голосование; null = доступно сразу. */
  availableAt: string | null;
  /** Глобальная пауза игры — таймер на кнопке тоже должен замирать. */
  isGamePaused: boolean;
};

/** Порог для досрочного голосования: 50% живых игроков. */
function requiredCount(total: number): number {
  return Math.ceil(total / 2);
}

function formatCooldown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function GameEarlyVoteBlock({
  isActive,
  onToggle,
  disabled,
  current,
  total,
  spectator = false,
  usedCount,
  availableAt,
  isGamePaused,
}: GameEarlyVoteBlockProps) {
  const required = requiredCount(total);
  const [hoveredBlock, setHoveredBlock] = useState(false);
  const [cooldownMs, setCooldownMs] = useState<number | null>(null);

  // Локальный таймер для отображения «ГОЛОСОВАТЬ ЧЕРЕЗ 2:47».
  useEffect(() => {
    if (!availableAt) {
      setCooldownMs(null);
      return;
    }

    const target = new Date(availableAt).getTime();

    const update = () => {
      const now = Date.now();
      const diff = target - now;
      setCooldownMs(diff > 0 ? diff : 0);
    };

    update();

    if (isGamePaused) {
      return;
    }

    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [availableAt, isGamePaused]);

  const maxEarlyUses = 2;
  const remainingEarlyUses = Math.max(0, maxEarlyUses - usedCount);
  const canUseNow =
    remainingEarlyUses > 0 && (!availableAt || (cooldownMs != null && cooldownMs <= 0));
  const hasCooldown =
    remainingEarlyUses > 0 && availableAt && cooldownMs != null && cooldownMs > 0;

  let buttonLabel: string;
  if (hasCooldown) {
    buttonLabel = `ГОЛОСОВАТЬ ЧЕРЕЗ ${formatCooldown(cooldownMs ?? 0)}`;
  } else if (remainingEarlyUses <= 0) {
    buttonLabel = 'ГОЛОСОВАНИЕ НЕДОСТУПНО';
  } else {
    // cooldownMs ещё null (инициализация) — canUseNow = false momentarily
    buttonLabel = 'ГОЛОСОВАНИЕ НЕДОСТУПНО';
  }

  const primaryDisabled = disabled || spectator || !canUseNow;
  const showPrimaryVoteButton = canUseNow && !spectator;

  return (
    <div
      className={`glass ${styles.wrap} ${spectator ? styles.wrapSpectator : ''}`}
      onMouseEnter={() => setHoveredBlock(true)}
      onMouseLeave={() => setHoveredBlock(false)}
    >
      <div className={styles.left}>
        <div className={styles.iconMain}>
          <LottieIcon
            src="/lottie/earlyvote.json"
            size={40}
            playOnHover
            hovered={hoveredBlock}
          />
        </div>
        <div className={styles.textBlock}>
          <h2 className={styles.title}>ДОСРОЧНОЕ ГОЛОСОВАНИЕ</h2>
          <p className={styles.subtitle}>
            50% игроков должны принять досрочное голосование
          </p>
        </div>
      </div>
      <div className={`${styles.buttonWrap} ${isActive ? styles.buttonWrapActive : ''}`}>
        {showPrimaryVoteButton ? (
          <PrimaryButtonLobby
            onClick={onToggle}
            soundClick="click"
            soundHover="hover"
            noIcon
            className={styles.buttonPrimary}
            disabled={primaryDisabled}
          >
            ГОЛОСОВАТЬ {current}/{required}
          </PrimaryButtonLobby>
        ) : (
          <button
            type="button"
            className={`glass glass-hover ${styles.buttonGlass}`}
            aria-disabled="true"
            onMouseEnter={() => playUI('hover')}
          >
            {spectator ? 'ВЫ НАБЛЮДАТЕЛЬ' : buttonLabel}
          </button>
        )}
      </div>
    </div>
  );
}