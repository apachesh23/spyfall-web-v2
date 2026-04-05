"use client";

import styles from "./backdrop.module.css";

export type BackdropProps = {
  children: React.ReactNode;
  contentClassName?: string;
  /** Видео-луп (лобби и т.д.) или повторяющийся тайл (игра) */
  backgroundType?: "video" | "tile";
};

export function Backdrop({
  children,
  contentClassName = "",
  backgroundType = "video",
}: BackdropProps) {
  return (
    <div className={styles.root}>
      <div className={`${styles.fillLayer} video-bg-layer`}>
        {backgroundType === "tile" ? (
          <>
            <div className={styles.tileLayer} aria-hidden />
            <div className={styles.tileDarkOverlay} aria-hidden />
          </>
        ) : (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className={styles.videoFill}
            aria-hidden
            poster="/videos/background-poster.webp"
            disablePictureInPicture
          >
            <source src="/videos/background.webm" type="video/webm" />
          </video>
        )}

        <div className={styles.scrim} aria-hidden />

        <div className={`${styles.fillLayer} vignette-overlay`} aria-hidden />
      </div>

      <div className={`${styles.content} ${contentClassName}`.trim()}>
        {children}
      </div>
    </div>
  );
}
