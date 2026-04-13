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
  /** Одна строка под кнопками: остаток попыток, таймер, «мало игроков» и т.д. */
  actionStatusLine?: string;
  /** Оба действия в «ожидании»: таймер, лимит, мало игроков, голосование — обе кнопки в стиле glass */
  buttonsMuted?: boolean;
  guessDisabled?: boolean;
  killDisabled?: boolean;
  guessUsed?: boolean;
  killUsed?: boolean;
  onGuessClick?: () => void;
  onKillClick?: () => void;
};

const DEFAULT_SUBTITLE = "Только 2 действия за игру. Перезарядка — 3 мин";

export function MatchSpyBlock({
  className = "",
  previewMode = false,
  modeHiddenThreat = false,
  subtitle,
  actionStatusLine,
  buttonsMuted = false,
  guessDisabled = false,
  killDisabled = false,
  guessUsed = false,
  killUsed = false,
  onGuessClick,
  onKillClick,
}: MatchSpyBlockProps) {
  const [hovered, setHovered] = useState(false);
  const resolvedSubtitle = subtitle ?? DEFAULT_SUBTITLE;

  const canGuess = !guessUsed && !guessDisabled;
  const canKill = !killUsed && !killDisabled && modeHiddenThreat;

  const guessClass = buttonsMuted
    ? `${styles.button} ${styles.buttonGlass} glass glass-hover`
    : `${styles.button} ${styles.guessButton} ${guessUsed ? styles.buttonUsed : ""} ${
        !canGuess && !guessUsed ? styles.guessButtonDim : ""
      }`.trim();

  const killClass = buttonsMuted
    ? `${styles.button} ${styles.buttonGlass} glass glass-hover`
    : `${styles.button} ${canKill ? styles.killButton : `${styles.killButtonLocked} glass glass-hover`} ${
        killUsed ? styles.buttonUsed : ""
      }`.trim();

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

      <div className={styles.right}>
        <div className={styles.buttons}>
          <PrimaryButton
            type="button"
            withIcon={false}
            disabled={!previewMode && (buttonsMuted || !canGuess)}
            onClick={() => {
              if (previewMode) return;
              onGuessClick?.();
            }}
            soundClick="click"
            soundHover="hover"
            className={guessClass}
          >
            <span className={styles.buttonTitleOnly}>
              {modeHiddenThreat ? "УГАДАТЬ ЛОКАЦИЮ" : "НАЗВАТЬ ЛОКАЦИЮ"}
            </span>
          </PrimaryButton>

          {modeHiddenThreat ? (
            <PrimaryButton
              type="button"
              withIcon={false}
              disabled={!previewMode && (buttonsMuted || !canKill)}
              onClick={() => {
                if (previewMode) return;
                onKillClick?.();
              }}
              soundClick="click"
              soundHover="hover"
              className={killClass}
            >
              <span className={styles.buttonTitleOnly}>УСТРАНИТЬ</span>
            </PrimaryButton>
          ) : null}
        </div>
        {actionStatusLine ? (
          <p className={styles.actionStatus} aria-live="polite">
            {actionStatusLine}
          </p>
        ) : null}
      </div>
    </div>
  );
}
