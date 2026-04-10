"use client";

import styles from "./MatchGameTimer.module.css";

type MatchGameTimerProps = {
  /** Уже отформатированное время MM:SS */
  clock: string;
  tone?: "normal" | "warn" | "danger" | "pause";
  /** В мобильном хедере — только цифры, без градиентной полосы */
  variant?: "block" | "inline";
  /** Пауза: вместо цифр — «ПАУЗА», серый стиль */
  paused?: boolean;
};

export function MatchGameTimer({
  clock,
  tone = "normal",
  variant = "block",
  paused = false,
}: MatchGameTimerProps) {
  const toneClass =
    paused || tone === "pause"
      ? styles.tonePause
      : tone === "danger"
        ? styles.toneDanger
        : tone === "warn"
          ? styles.toneWarn
          : styles.toneNormal;

  if (variant === "inline") {
    return (
      <div className={`${styles.wrapInline} ${toneClass}`}>
        <span className={styles.digitsInline} aria-live="polite">
          {paused ? "ПАУЗА" : clock}
        </span>
      </div>
    );
  }

  return (
    <div className={`${styles.wrapBlock} ${toneClass} ${paused ? styles.wrapBlockPaused : ""}`}>
      {paused ? (
        <span className={styles.pauseLabel} aria-live="polite">
          ПАУЗА
        </span>
      ) : (
        <span className={styles.digits} aria-live="polite">
          {clock}
        </span>
      )}
    </div>
  );
}
