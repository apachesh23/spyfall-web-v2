"use client";

import { use } from "react";
import { MatchPlayMusicMount } from "@/features/game-music";
import { Backdrop, TopBar } from "@/shared/components/layout";
import { ReactionsBar, ReactionsProvider } from "@/features/reactions";
import { MatchPlayUiReadyProvider, useMatchPlayUiReady } from "@/features/match/context/MatchPlayUiReadyContext";
import styles from "@/features/match/layout/MatchGamePageLayout/MatchGamePageLayout.module.css";

function PlayLayoutBody({ children }: { children: React.ReactNode }) {
  const { uiReady } = useMatchPlayUiReady();

  return (
    <div className={`${styles.screenRoot} ${!uiReady ? styles.matchPlayShellHidden : ""}`}>
      <div className={styles.screenGrid}>
        <header className={styles.header}>
          <TopBar />
        </header>
        <div className={styles.pauseFilterMainColumn} data-play-pause-filter>
          <main className={styles.main}>
            <div className={styles.mainContent}>
              <div className={styles.container}>{children}</div>
            </div>
            <ReactionsBar />
          </main>
        </div>
      </div>
    </div>
  );
}

function PlayBackdrop({ children }: { children: React.ReactNode }) {
  const { uiReady } = useMatchPlayUiReady();
  return (
    <Backdrop
      contentClassName="videoContentLobbyMobile"
      playLayoutRoot
      showVideoBackground={uiReady}
    >
      {children}
    </Backdrop>
  );
}

export default function PlayLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ sessionId: string }>;
}) {
  use(params);

  return (
    <ReactionsProvider>
      <MatchPlayUiReadyProvider>
        <PlayBackdrop>
          <MatchPlayMusicMount />
          <PlayLayoutBody>{children}</PlayLayoutBody>
        </PlayBackdrop>
      </MatchPlayUiReadyProvider>
    </ReactionsProvider>
  );
}
