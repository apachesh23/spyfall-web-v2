"use client";

import { useState } from "react";
import { LottieIcon } from "@/lib/lottie";
import { PrimaryButton } from "@/shared/components/ui/PrimaryButton/PrimaryButton";
import { playUI } from "@/lib/sound";
import styles from "./MatchEarlyVoteBlock.module.css";

export type MatchEarlyVoteBlockProps = {
  className?: string;
  /** Игрок в режиме наблюдателя — блок приглушён */
  spectator?: boolean;
  /** Изгнан голосованием — не участвует (клик на сервере игнорируется) */
  eliminated?: boolean;
  /** Подсветка «я нажал» на основной кнопке */
  isActive?: boolean;
  /** Жёлтая кнопка; иначе стеклянная с secondaryLabel */
  showPrimaryButton?: boolean;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimaryClick?: () => void;
  disabled?: boolean;
};

export function MatchEarlyVoteBlock({
  className = "",
  spectator = false,
  eliminated = false,
  isActive = false,
  showPrimaryButton = true,
  primaryLabel = "ГОЛОСОВАТЬ 0/1",
  secondaryLabel = "ГОЛОСОВАНИЕ НЕДОСТУПНО",
  onPrimaryClick,
  disabled = false,
}: MatchEarlyVoteBlockProps) {
  const [hoveredBlock, setHoveredBlock] = useState(false);
  const outOfPlay = spectator || eliminated;
  const showPrimary = showPrimaryButton && !outOfPlay;
  const primaryDisabled = disabled || outOfPlay || !showPrimaryButton;
  const glassLabel = eliminated ? "ВЫ ВЫБЫЛИ" : spectator ? "ВЫ НАБЛЮДАТЕЛЬ" : secondaryLabel;

  return (
    <div
      className={`glass ${styles.wrap} ${outOfPlay ? styles.wrapSpectator : ""} ${className}`.trim()}
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
            {eliminated
              ? "Вы не участвуете в раунде — дождитесь следующего голосования или конца партии"
              : "50% игроков должны принять досрочное голосование"}
          </p>
        </div>
      </div>
      <div className={`${styles.buttonWrap} ${isActive ? styles.buttonWrapActive : ""}`}>
        {showPrimary ? (
          <PrimaryButton
            type="button"
            withIcon={false}
            onClick={onPrimaryClick}
            soundClick="click"
            soundHover="hover"
            className={styles.buttonPrimary}
            disabled={primaryDisabled}
          >
            {primaryLabel}
          </PrimaryButton>
        ) : (
          <button
            type="button"
            className={`glass glass-hover ${styles.buttonGlass}`}
            aria-disabled="true"
            onMouseEnter={() => playUI("hover")}
          >
            {glassLabel}
          </button>
        )}
      </div>
    </div>
  );
}
