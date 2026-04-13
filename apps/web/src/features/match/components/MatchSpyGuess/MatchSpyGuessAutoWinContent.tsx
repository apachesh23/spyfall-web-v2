"use client";

import styles from "./MatchSpyGuessSplash.module.css";

export type MatchSpyGuessAutoWinContentProps = {
  guessText: string;
};

/** Фаза после cinematic: точное совпадение с локацией, без голосования мирных. */
export function MatchSpyGuessAutoWinContent({ guessText }: MatchSpyGuessAutoWinContentProps) {
  return (
    <div className={styles.centerWrap}>
      <p className={styles.subtitle}>Шпион думает что это локация:</p>
      <div className={`glass ${styles.guessBlock}`}>{guessText}</div>
      <p className={styles.autoWinLabel}>Победа засчитана автоматически</p>
    </div>
  );
}
