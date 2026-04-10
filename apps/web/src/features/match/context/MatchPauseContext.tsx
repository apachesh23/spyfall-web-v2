"use client";

import { createContext, useContext, type ReactNode } from "react";

export type MatchPauseContextValue = {
  /** Единый рычаг паузы матча (из `rooms.settings.match_paused` + realtime). */
  isPaused: boolean;
  /** Секунды, зафиксированные при паузе (для будущих таймеров / early-vote и т.д.). */
  frozenRemainingSec: number | null;
};

const MatchPauseContext = createContext<MatchPauseContextValue | null>(null);

export function MatchPauseProvider({
  value,
  children,
}: {
  value: MatchPauseContextValue;
  children: ReactNode;
}) {
  return <MatchPauseContext.Provider value={value}>{children}</MatchPauseContext.Provider>;
}

export function useMatchPause(): MatchPauseContextValue {
  const ctx = useContext(MatchPauseContext);
  if (!ctx) {
    return { isPaused: false, frozenRemainingSec: null };
  }
  return ctx;
}
