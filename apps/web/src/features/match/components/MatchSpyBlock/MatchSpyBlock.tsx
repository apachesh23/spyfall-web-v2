"use client";

import { useState } from "react";
import { LottieIcon } from "@/lib/lottie";
import { PrimaryButton } from "@/shared/components/ui/PrimaryButton/PrimaryButton";
import styles from "./MatchSpyBlock.module.css";

export type MatchSpyBlockProps = {
  className?: string;
  /** Только визуал (например для правил): без кликов */
  previewMode?: boolean;
  /** Режим «Скрытая угроза»: вторая кнопка «Устранить» */
  modeHiddenThreat?: boolean;
  subtitle?: string;
  guessStatusLabel?: string;
  killStatusLabel?: string;
  guessDisabled?: boolean;
  killDisabled?: boolean;
  /** Стеклянный стиль кнопки устранения (таймер / мало игроков) */
  killUseGlassStyle?: boolean;
  guessUsed?: boolean;
  killUsed?: boolean;
  onGuessClick?: () => void;
  onKillClick?: () => void;
};

const DEFAULT_SUBTITLE = "Назвать локацию можно только один раз за игру.";
const DEFAULT_SUBTITLE_HIDDEN = "Вы можете выполнить только одно действие за игру.";
const DEFAULT_GUESS_STATUS = "⚡ Доступно";
const DEFAULT_KILL_STATUS = "⚡ Доступно";

export function MatchSpyBlock({
  className = "",
  previewMode = false,
  modeHiddenThreat = false,
  subtitle,
  guessStatusLabel = DEFAULT_GUESS_STATUS,
  killStatusLabel = DEFAULT_KILL_STATUS,
  guessDisabled = false,
  killDisabled = false,
  killUseGlassStyle = false,
  guessUsed = false,
  killUsed = false,
  onGuessClick,
  onKillClick,
}: MatchSpyBlockProps) {
  const [hovered, setHovered] = useState(false);
  const resolvedSubtitle =
    subtitle ??
    (modeHiddenThreat ? DEFAULT_SUBTITLE_HIDDEN : DEFAULT_SUBTITLE);

  const canGuess = !guessUsed && !guessDisabled;
  const canKill = !killUsed && !killDisabled && modeHiddenThreat;

  return (
    <div
      className={`glass ${styles.block} ${previewMode ? styles.blockPreview : ""} ${className}`.trim()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.left}>
        <div className={styles.iconMain}>
          <LottieIcon
            src="/lottie/spy-action.json"
            size={40}
            playOnHover
            hovered={hovered}
          />
        </div>
        <div className={styles.textBlock}>
          <h2 className={styles.title}>ДЕЙСТВИЕ ШПИОНА</h2>
          <p className={styles.subtitle}>{resolvedSubtitle}</p>
        </div>
      </div>

      <div className={styles.buttons}>
        <PrimaryButton
          type="button"
          withIcon={false}
          disabled={!canGuess}
          onClick={() => {
            if (previewMode) return;
            onGuessClick?.();
          }}
          soundClick="click"
          soundHover="hover"
          className={`${styles.button} ${styles.guessButton} ${guessUsed ? styles.buttonUsed : ""}`}
        >
          <span className={styles.buttonText}>
            <span className={styles.buttonTitle}>НАЗВАТЬ ЛОКАЦИЮ</span>
            <span
              className={`${styles.buttonStatus} ${
                guessUsed ? styles.buttonStatusUsed : styles.buttonStatusAvailable
              }`}
            >
              {guessStatusLabel}
            </span>
          </span>
        </PrimaryButton>

        {modeHiddenThreat ? (
          <PrimaryButton
            type="button"
            withIcon={false}
            disabled={!canKill}
            onClick={() => {
              if (previewMode) return;
              onKillClick?.();
            }}
            soundClick="click"
            soundHover="hover"
            className={`${styles.button} ${
              killUseGlassStyle ? `${styles.killButtonLocked} glass glass-hover` : styles.killButton
            } ${killUsed ? styles.buttonUsed : ""}`}
          >
            <span className={styles.buttonText}>
              <span className={styles.buttonTitle}>УСТРАНИТЬ</span>
              <span
                className={`${styles.buttonStatus} ${
                  killDisabled && !killUsed
                    ? styles.buttonStatusUnavailable
                    : killUsed
                      ? styles.buttonStatusUsed
                      : killUseGlassStyle
                        ? styles.buttonStatusTimer
                        : styles.buttonStatusAvailable
                }`}
              >
                {killStatusLabel}
              </span>
            </span>
          </PrimaryButton>
        ) : null}
      </div>
    </div>
  );
}
