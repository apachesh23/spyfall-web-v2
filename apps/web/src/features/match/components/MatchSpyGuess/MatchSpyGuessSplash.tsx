"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { playVFX } from "@/lib/sound";
import { LottieIcon } from "@/lib/lottie";
import styles from "./MatchSpyGuessSplash.module.css";

/** В public пока нет `splash/spyguess.json` — тот же ассет, что у блока шпиона. */
const SPY_GUESS_LOTTIE = "/lottie/spy-action.json";
const LAST_SECONDS_ANIMATED = 10;
const FRONT_ANGLE = -3;
const easeSmooth = [0.22, 1, 0.36, 1] as const;
const DARK_FRONT = "#262523";
const DARK_BACK = "#1c1b1a";

const topFrontVariants = {
  hidden: { clipPath: "inset(0 0 0 100%)" },
  visible: { clipPath: "inset(0 0 0 0)", transition: { duration: 0.6, ease: easeSmooth } },
  exit: { clipPath: "inset(0 100% 0 0)", transition: { duration: 0.4, ease: easeSmooth } },
};
const bottomBackVariants = {
  hidden: { clipPath: "inset(0 0 0 100%)" },
  visible: { clipPath: "inset(0 0% 0 0)", transition: { duration: 0.65, delay: 0.05, ease: easeSmooth } },
  exit: { clipPath: "inset(0 100% 0 0)", transition: { duration: 0.4, ease: easeSmooth } },
};
const bottomFrontVariants = {
  hidden: { clipPath: "inset(0 100% 0 0)" },
  visible: { clipPath: "inset(0 0% 0 0)", transition: { duration: 0.6, ease: easeSmooth } },
  exit: { clipPath: "inset(0 0 0 100%)", transition: { duration: 0.4, ease: easeSmooth } },
};

export type MatchSpyGuessSplashProps = {
  title?: string;
  countdownLabel?: string;
  /** Дедлайн голосования (unix ms), синхронизация с `clockSkewMs` как в матче. */
  endsAtMs?: number;
  clockSkewMs?: number;
  /**
   * Если > 0 — до этого момента таймер показывает полное окно голосования (не «съедает» cinematic).
   */
  voteStartsAtMs?: number;
  /** Рендер под Emergency intro (z-index ниже 175). */
  underEmergencyLayer?: boolean;
  /**
   * Если true — при нуле не вызываем `onClose` (сервер закроет фазу).
   * Если false — по нулю: woosh_out и `onClose` (как авто-закрытие сплэша).
   */
  holdAtZero?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
};

export function MatchSpyGuessSplash({
  title = "ШПИОН УГАДАЛ ?",
  countdownLabel = "ВЫБЕРИТЕ ОТВЕТ...",
  endsAtMs,
  clockSkewMs = 0,
  voteStartsAtMs = 0,
  underEmergencyLayer = false,
  holdAtZero = true,
  onClose,
  children,
}: MatchSpyGuessSplashProps) {
  const computeRemain = () => {
    if (!endsAtMs) return 0;
    const now = Date.now() + clockSkewMs;
    const t0 = voteStartsAtMs > 0 ? Math.max(now, voteStartsAtMs) : now;
    return Math.max(0, Math.ceil((endsAtMs - t0) / 1000));
  };

  const [count, setCount] = useState(() => computeRemain());
  const [showNumber, setShowNumber] = useState(false);
  const prevCountRef = useRef(count);
  const closedRef = useRef(false);

  const hasCountdown = !!endsAtMs;

  useEffect(() => {
    if (!endsAtMs) return;
    const tick = () => {
      const now = Date.now() + clockSkewMs;
      const t0 = voteStartsAtMs > 0 ? Math.max(now, voteStartsAtMs) : now;
      setCount(Math.max(0, Math.ceil((endsAtMs - t0) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAtMs, clockSkewMs, voteStartsAtMs]);

  useEffect(() => {
    if (!hasCountdown) return;
    const t = setTimeout(() => setShowNumber(true), 600);
    return () => clearTimeout(t);
  }, [hasCountdown]);

  useEffect(() => {
    if (!hasCountdown || !showNumber || count > LAST_SECONDS_ANIMATED) return;
    if (count < prevCountRef.current) {
      if (count === 0) playVFX("countdown_last");
      else playVFX("countdown_sec");
    }
    prevCountRef.current = count;
  }, [hasCountdown, showNumber, count]);

  useEffect(() => {
    if (!hasCountdown || holdAtZero) return;
    if (count <= 0) {
      if (!closedRef.current) {
        closedRef.current = true;
        const t = setTimeout(() => {
          playVFX("woosh_out");
          onClose?.();
        }, 800);
        return () => clearTimeout(t);
      }
      return undefined;
    }
    return undefined;
  }, [hasCountdown, holdAtZero, count, onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`${styles.overlay}${underEmergencyLayer ? ` ${styles.overlayUnderEmergency}` : ""}`.trim()}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      style={
        {
          "--voting-front": DARK_FRONT,
          "--voting-back": DARK_BACK,
          "--top-strip-text-rotate": "0deg",
          "--bottom-strip-text-rotate": "0deg",
        } as React.CSSProperties
      }
    >
      <div className={styles.inner}>
        <div className={styles.topStrip}>
          <motion.div
            className={styles.topStripFront}
            style={{ transform: `rotate(${FRONT_ANGLE}deg)` }}
            variants={topFrontVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className={styles.topStripContent}>
              <LottieIcon src={SPY_GUESS_LOTTIE} loop size={60} />
              <span className={styles.topStripText}>{title}</span>
            </div>
          </motion.div>
        </div>

        <div className={styles.center}>{children}</div>

        <div className={styles.bottomStrip}>
          <motion.div
            className={styles.bottomBack}
            style={{ transform: `rotate(${FRONT_ANGLE}deg) translateY(50px)` }}
            variants={bottomBackVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          />
          <motion.div
            className={styles.bottomFront}
            style={{ transform: `rotate(${FRONT_ANGLE}deg)` }}
            variants={bottomFrontVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {hasCountdown && (
              <span className={`${styles.bottomStripText} ${styles.countdownRow}`}>
                <span className={styles.bottomStripLabel}>{countdownLabel}</span>
                <motion.span
                  className={styles.countdownNumberWrap}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.6, duration: 0.25 } }}
                  exit={{ opacity: 0 }}
                >
                  {showNumber ? (
                    count > LAST_SECONDS_ANIMATED ? (
                      <span className={styles.countdownNumber}>{count}</span>
                    ) : (
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={count}
                          className={styles.countdownNumber}
                          initial={{ scale: 0.35, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1, transition: { type: "spring", stiffness: 380, damping: 22 } }}
                          exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.2 } }}
                        >
                          {count}
                        </motion.span>
                      </AnimatePresence>
                    )
                  ) : (
                    <span className={styles.countdownNumber}>—</span>
                  )}
                </motion.span>
              </span>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
