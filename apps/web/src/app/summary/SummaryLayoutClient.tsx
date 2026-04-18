"use client";

import { useEffect } from "react";
import { Backdrop, TopBar } from "@/shared/components/layout";
import { useRouteLoaderStore } from "@/store/route-loader-store";
import styles from "@/features/match/layout/MatchGamePageLayout/MatchGamePageLayout.module.css";
import shell from "./summary-shell.module.css";

export default function SummaryLayoutClient({ children }: { children: React.ReactNode }) {
  const stopGlobalLoader = useRouteLoaderStore((s) => s.stop);

  useEffect(() => {
    stopGlobalLoader();
  }, [stopGlobalLoader]);

  return (
    <Backdrop contentClassName="videoContentLobbyMobile" backgroundType="tile" showVideoBackground>
      <div className={styles.screenRoot}>
        <div className={styles.screenGrid}>
          <header className={styles.header}>
            <TopBar />
          </header>
          <main className={styles.main}>
            <div className={`${styles.mainContent} ${shell.summaryMainDesktop}`}>
              <div className={`${styles.container} ${shell.summaryContainerDesktop}`}>{children}</div>
            </div>
          </main>
        </div>
      </div>
    </Backdrop>
  );
}
