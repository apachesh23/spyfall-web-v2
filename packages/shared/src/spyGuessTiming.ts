/**
 * Окно Emergency (прилёт + стекло + кнопка + пауза + exit-fall) до старта таймера голосования.
 * Сервер: `spyGuessVoteStartsAt = submitAt + this`. Дублируется в `apps/game-server` (без импорта shared).
 * ~6 с — запас над типичным клиентским cinematic, без длинной «блокировки» голосов после UI.
 */
export const SPY_GUESS_CINEMATIC_TOTAL_MS = 6_000;

/** После cinematic: фаза «авто-победа» без голосования мирных. */
export const SPY_GUESS_AUTO_WIN_PHASE_MS = 10_000;
