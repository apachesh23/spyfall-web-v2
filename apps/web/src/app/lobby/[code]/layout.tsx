"use client";

import { use } from "react";
import { AuthMusicMount, LobbyMusicMount } from "@/features/game-music";
import { Backdrop, TopBar } from "@/shared/components/layout";
import { ReactionsBar, ReactionsProvider } from "@/features/reactions";
import { LobbyUiReadyProvider, useLobbyUiReady } from "@/features/lobby/contexts/LobbyUiReadyContext";
import styles from "@/features/lobby/lobby-screen.module.css";

function LobbyBackdrop({ children }: { children: React.ReactNode }) {
  const { uiReady } = useLobbyUiReady();
  return (
    <Backdrop contentClassName="videoContentLobbyMobile" showVideoBackground={uiReady}>
      {children}
    </Backdrop>
  );
}

function LobbyLayoutBody({ children }: { children: React.ReactNode }) {
  const { uiReady } = useLobbyUiReady();
  return (
    <div className={`${styles.screenRoot} ${!uiReady ? styles.lobbyShellHidden : ""}`}>
      <div className={styles.screenGrid}>
        <header className={styles.header}>
          <TopBar />
        </header>
        <main className={styles.main}>
          <div className={styles.mainContent}>
            <div className={styles.container}>{children}</div>
          </div>
          <ReactionsBar />
        </main>
      </div>
    </div>
  );
}

export default function LobbyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  use(params);

  return (
    <ReactionsProvider>
      <LobbyUiReadyProvider>
        <LobbyBackdrop>
          <AuthMusicMount />
          <LobbyMusicMount />
          <LobbyLayoutBody>{children}</LobbyLayoutBody>
        </LobbyBackdrop>
      </LobbyUiReadyProvider>
    </ReactionsProvider>
  );
}
