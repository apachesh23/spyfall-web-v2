'use client';

import { use } from 'react';
import { AuthMusicMount } from '@/features/game-music/components/AuthMusicMount';
import { LobbyMusicMount } from '@/features/game-music/components/LobbyMusicMount';
import { VideoBackground } from '@/shared/components/layout/VideoBackground';
import { TopBar } from '@/shared/components/layout/TopBar';
import { ReactionsBar } from '@/features/reactions/components/ReactionsBar';
import { ReactionsProvider } from '@/features/reactions/context';
import styles from './layout.module.css';

export default function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  use(params);

  return (
    <ReactionsProvider>
      <VideoBackground contentClassName="videoContentLobbyMobile" >
        <AuthMusicMount />
        <LobbyMusicMount />
        <div className={styles.screenRoot}>
          <div className={styles.screenGrid}>
            <header className={styles.header}>
              <TopBar />
            </header>
            <main className={styles.main}>
              <div className={styles.mainContent}>
                <div className={styles.container}>
                  {children}
                </div>
              </div>
              <ReactionsBar />
            </main>
          </div>
        </div>
      </VideoBackground>
    </ReactionsProvider>
  );
}
