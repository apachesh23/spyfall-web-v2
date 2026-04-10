import type { ReactNode } from "react";

/** Базовые пропсы таймера/оболочки, расширяются в `MatchVoteRootProps`. */
export type VotingSplashProps = {
  title?: string;
  titleBadge?: string;
  countdownLabel?: string;
  countdownSeconds?: number;
  eventAt?: string;
  endsAt?: string;
  /** Сдвиг клиентских часов относительно сервера (как в MatchScreen ping/pong). */
  clockSkewMs?: number;
  /** Не используем при голосовании: переходы только с сервера. */
  onClose?: () => void;
  resultCountdown?: number | null;
  resultCountdownLabel?: string;
  colors?: { front: string; back: string };
  children?: ReactNode;
};
