"use client";

import { AuthMusicMount } from "@/features/game-music";
import { Backdrop, TopBar } from "@/shared/components/layout";
import styles from "../entry.module.css";

export function EntryShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <Backdrop>
      <AuthMusicMount />
      <div className={styles.screenRoot}>
        <div className={styles.screenGrid}>
          <header className={styles.header}>
            <TopBar />
          </header>
          <main className={styles.main}>
            <div className={styles.formContainer}>{children}</div>
          </main>
        </div>
      </div>
    </Backdrop>
  );
}
