'use client';

import styles from './GameDebugEndGame.module.css';

type GameDebugEndGameProps = {
  isHost: boolean;
  finishGameAndReturnToRoom: () => void | Promise<void>;
};

/** Только dev: мгновенно завершить игру и уйти в лобби / summary — как кнопка на победном сплэше. */
export function GameDebugEndGame({ isHost, finishGameAndReturnToRoom }: GameDebugEndGameProps) {
  if (process.env.NODE_ENV !== 'development') return null;
  if (!isHost) return null;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => void finishGameAndReturnToRoom()}
        title="DEV: то же, что «завершить игру» на победном экране — в лобби или итог"
      >
        DEV · Завершить игру
      </button>
    </div>
  );
}
