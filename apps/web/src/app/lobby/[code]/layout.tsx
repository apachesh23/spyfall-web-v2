"use client";

import { use } from "react";
import { AuthMusicMount, LobbyMusicMount } from "@/features/game-music";
import { Backdrop, TopBar } from "@/shared/components/layout";
import { ReactionsBar, ReactionsProvider } from "@/features/reactions";
import styles from "@/features/lobby/lobby-screen.module.css";

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
      <Backdrop contentClassName="videoContentLobbyMobile">
        <AuthMusicMount />
        <LobbyMusicMount />
        <div className={styles.screenRoot}>
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
      </Backdrop>
    </ReactionsProvider>
  );
}
