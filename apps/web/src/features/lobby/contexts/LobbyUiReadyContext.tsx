"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type LobbyUiReadyValue = {
  uiReady: boolean;
  setUiReady: (v: boolean) => void;
};

const LobbyUiReadyContext = createContext<LobbyUiReadyValue | null>(null);

export function LobbyUiReadyProvider({ children }: { children: ReactNode }) {
  const [uiReady, setUiReady] = useState(false);
  const value = useMemo(() => ({ uiReady, setUiReady }), [uiReady]);
  return <LobbyUiReadyContext.Provider value={value}>{children}</LobbyUiReadyContext.Provider>;
}

export function useLobbyUiReady(): LobbyUiReadyValue {
  const ctx = useContext(LobbyUiReadyContext);
  if (!ctx) {
    return { uiReady: true, setUiReady: () => {} };
  }
  return ctx;
}
