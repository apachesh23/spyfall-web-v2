/**
 * Автопобеда по похожести строк (fuzzball). Всё остальное — на голосование мирных, без «тихого промаха».
 *
 * В автопобеду входят только `ratio` и `token_sort_ratio` (без `partial_ratio` / `WRatio`),
 * иначе короткие ответы вроде «Станция» дают ложную победу.
 */

import { ratio, token_sort_ratio } from "fuzzball";

export type SpyGuessClass = "win" | "vote";

const fuzzOpts = {
  full_process: true,
  force_ascii: false,
} as const;

function scoreAuto(secret: string, guess: string): number {
  return Math.max(ratio(guess, secret, fuzzOpts), token_sort_ratio(guess, secret, fuzzOpts));
}

/** Порог автопобеды: «Космо станция» ≈ 75, «Космическая станция» = 100. */
const WIN_MIN = 74;

/**
 * @param secret — каноническое название локации из матча
 * @param guess — ввод шпиона
 */
export function classifySpyLocationGuess(secret: string, guess: string): SpyGuessClass {
  const g0 = guess.trim();
  const s0 = secret.trim();
  if (!g0 || !s0) return "vote";

  const auto = scoreAuto(s0, g0);
  if (auto >= WIN_MIN) return "win";
  return "vote";
}
