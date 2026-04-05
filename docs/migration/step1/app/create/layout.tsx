'use client';

import { AuthMusicMount } from '@/features/game-music/components/AuthMusicMount';
import { VideoBackground } from '@/shared/components/layout/VideoBackground';
import { TopBar } from '@/shared/components/layout/TopBar';
import styles from './layout.module.css';

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VideoBackground>
      <AuthMusicMount />
      <div className={styles.screenRoot}>
        <div className={styles.screenGrid}>
          <header className={styles.header}>
            <TopBar />
          </header>
          <main className={styles.main}>
            <div className={styles.formContainer}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </VideoBackground>
  );
}
