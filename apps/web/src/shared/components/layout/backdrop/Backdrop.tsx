"use client";

import { useEffect, useState } from "react";
import styles from "./backdrop.module.css";

const VIDEO_POSTER = "/videos/background-poster.webp";
const VIDEO_SRC = "/videos/background.webm";

/**
 * Видео только после mount: иначе SSR даёт другие пропсы `<video>` (напр. disablePictureInPicture),
 * плюс расширения вроде «Picture-in-Picture everywhere» вставляют DOM и ломают гидратацию.
 */
function ClientMountVideoBackdrop() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div
        className={styles.videoFill}
        aria-hidden
        style={{
          backgroundImage: `url(${VIDEO_POSTER})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    );
  }

  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      className={styles.videoFill}
      aria-hidden
      poster={VIDEO_POSTER}
      disablePictureInPicture={true}
    >
      <source src={VIDEO_SRC} type="video/webm" />
    </video>
  );
}

export type BackdropProps = {
  children: React.ReactNode;
  contentClassName?: string;
  /** Видео-луп (лобби и т.д.) или повторяющийся тайл (игра) */
  backgroundType?: "video" | "tile";
  /** Play: метки для ч/б при паузе — фон, без TopBar (см. `body[data-match-paused-grayscale]`) */
  playLayoutRoot?: boolean;
  /**
   * Play: пока false — плоский фон `--spyfall-route-loader-bg` как у FullscreenLoader (бесшовно до появления логотипа).
   */
  showVideoBackground?: boolean;
};

export function Backdrop({
  children,
  contentClassName = "",
  backgroundType = "video",
  playLayoutRoot = false,
  showVideoBackground = true,
}: BackdropProps) {
  return (
    <div className={styles.root}>
      <div
        className={`${styles.fillLayer} video-bg-layer`}
        {...(playLayoutRoot ? { "data-play-pause-filter": "" } : {})}
      >
        {showVideoBackground ? (
          <>
            {backgroundType === "tile" ? (
              <>
                <div className={styles.tileLayer} aria-hidden />
                <div className={styles.tileDarkOverlay} aria-hidden />
              </>
            ) : (
              <ClientMountVideoBackdrop />
            )}

            <div className={styles.scrim} aria-hidden />

            <div className={`${styles.fillLayer} vignette-overlay`} aria-hidden />
          </>
        ) : (
          <div className={styles.loaderSolidFill} aria-hidden />
        )}
      </div>

      <div className={`${styles.content} ${contentClassName}`.trim()}>
        {children}
      </div>
    </div>
  );
}
