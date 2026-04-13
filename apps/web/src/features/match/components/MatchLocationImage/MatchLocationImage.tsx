"use client";

import { useCallback, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { locationImageCandidates, locationImageFallbackSrc } from "@/lib/locations";
import styles from "./MatchLocationImage.module.css";

export type MatchLocationImageProps = {
  imageKey?: string | null;
  isSpy?: boolean;
  /** URL карточки шпиона из state (например /locations/spy1.webp) */
  spyCardUrl?: string | null;
};

export function MatchLocationImage({
  imageKey,
  isSpy = false,
  spyCardUrl = null,
}: MatchLocationImageProps) {
  const [imgAttempt, setImgAttempt] = useState(0);
  const candidates = isSpy
    ? [
        ...(spyCardUrl?.trim() ? [spyCardUrl.trim()] : []),
        "/locations/spy1.webp",
        "/locations/spy2.webp",
        "/locations/spy3.webp",
        "/locations/spy4.webp",
      ]
    : locationImageCandidates(imageKey ?? "");
  const idxMax = Math.max(0, candidates.length - 1);
  const imgIdx = Math.min(imgAttempt, idxMax);
  const src = candidates[imgIdx] ?? locationImageFallbackSrc();
  const hasImage = Boolean(src && src.length > 0);

  const onError = useCallback(() => {
    setImgAttempt((a) => (a < idxMax ? a + 1 : a));
  }, [idxMax]);

  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-7deg", "7deg"]);
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["100%", "0%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["100%", "0%"]);
  const glareOpacity = useTransform([mouseXSpring, mouseYSpring], ([cx, cy]: number[]) => {
    const distance = Math.sqrt(cx * cx + cy * cy);
    return Math.min(distance * 1.5, 0.4);
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width - 0.5;
    const relativeY = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(relativeX);
    y.set(relativeY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div
      className={styles.container}
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={styles.tiltWrapper}
        style={
          {
            "--top": "11%",
            "--left": "4.5%",
            "--width": "91%",
            "--height": "79%",
          } as React.CSSProperties
        }
      >
        <motion.div
          className={styles.innerImage}
          style={{
            rotateX,
            rotateY,
            scale: 1.08,
            transformStyle: "preserve-3d",
          }}
        >
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt="Location"
              className={styles.locationImage}
              decoding="async"
              onError={onError}
            />
          ) : (
            <div className={styles.locationSkeleton} aria-hidden />
          )}
          <motion.div
            className={styles.glareLayer}
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 60%)",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              opacity: glareOpacity as any,
              WebkitMaskImage: "radial-gradient(circle, black, transparent)",
              transform: "translateZ(1px)",
              left: glareX,
              top: glareY,
              x: "-50%",
              y: "-50%",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any}
          />
        </motion.div>
      </div>

      {isSpy ? (
        <div className={styles.spyOverlay}>
          <div className={styles.spyOverlayInner}>
            <p className={styles.spyTitle}>Ты шпион</p>
            <p className={styles.spySubtitle}>
              Вычислите локацию до конца раунда или не дайте себя раскрыть.
            </p>
          </div>
        </div>
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/locations/location_frame.webp"
        alt="Рамка"
        className={styles.frameImage}
        width={1450}
        height={927}
        decoding="async"
      />
    </div>
  );
}
