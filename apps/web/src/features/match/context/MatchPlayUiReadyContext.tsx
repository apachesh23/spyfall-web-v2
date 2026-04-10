"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type MatchPlayUiReadyValue = {
  /** Игровой стол готов к показу (та же логика, что и снятие глобального лоадера). */
  uiReady: boolean;
  setUiReady: (v: boolean) => void;
};

const MatchPlayUiReadyContext = createContext<MatchPlayUiReadyValue | null>(null);

export function MatchPlayUiReadyProvider({ children }: { children: ReactNode }) {
  const [uiReady, setUiReady] = useState(false);
  const value = useMemo(() => ({ uiReady, setUiReady }), [uiReady]);
  return <MatchPlayUiReadyContext.Provider value={value}>{children}</MatchPlayUiReadyContext.Provider>;
}

export function useMatchPlayUiReady(): MatchPlayUiReadyValue {
  const ctx = useContext(MatchPlayUiReadyContext);
  if (!ctx) {
    return { uiReady: true, setUiReady: () => {} };
  }
  return ctx;
}
