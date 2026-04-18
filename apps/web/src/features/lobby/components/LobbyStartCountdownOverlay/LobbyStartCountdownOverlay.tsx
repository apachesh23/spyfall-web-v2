"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { playVFX } from "@/lib/sound";
import styles from "./LobbyStartCountdownOverlay.module.css";

const STEPS = ["3", "2", "1", "GO"] as const;

const COUNTDOWN_BEAT_MS = 1000;
const GO_HOLD_MS = 1500;

// Делаем появление чуть более упругим и взрывным
const enterTransition = {
  type: "spring" as const,
  stiffness: 500, // Увеличили жесткость
  damping: 20,    // Немного уменьшили затухание для отдачи
  mass: 0.8,
};

// Плавное растворение старой цифры
const exitTransition = {
  duration: 0.35,
  ease: "easeOut", // Отличное сглаживание для растворения
};

type LobbyStartCountdownOverlayProps = {
  open: boolean;
  onComplete: () => void;
};

export function LobbyStartCountdownOverlay({ open, onComplete }: LobbyStartCountdownOverlayProps) {
  const [index, setIndex] = useState(-1);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setIndex(-1);
      completedRef.current = false;
      return;
    }
    setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open || index < 0 || index >= STEPS.length) return;
    if (index < 3) {
      playVFX("countdown_sec");
    } else {
      playVFX("countdown_last");
    }
  }, [open, index]);

  useEffect(() => {
    if (!open || index < 0 || index >= STEPS.length) return;

    if (index === STEPS.length - 1) {
      const id = window.setTimeout(() => {
        if (completedRef.current) return;
        completedRef.current = true;
        onComplete();
      }, GO_HOLD_MS);
      return () => window.clearTimeout(id);
    }

    const id = window.setTimeout(() => {
      setIndex((i) => i + 1);
    }, COUNTDOWN_BEAT_MS);
    return () => window.clearTimeout(id);
  }, [open, index, onComplete]);

  if (typeof document === "undefined") return null;
  if (!open) return null;

  const label = index >= 0 && index < STEPS.length ? STEPS[index] : null;

  return createPortal(
    <div className={styles.root} role="presentation" aria-hidden>
      <div className={styles.stage}>
        {/* mode="sync" позволяет старой и новой цифре анимироваться одновременно */}
        <AnimatePresence mode="sync">
          {label != null ? (
            <motion.div
              key={`${index}-${label}`}
              className={`${styles.glyph} ${label === "GO" ? styles.glyphGo : styles.glyphDigit}`}
              initial={{
                scale: 0,
                opacity: 0,
                rotate: -15, // Чуть больший угол для старта
                filter: "blur(20px)",
              }}
              animate={{
                scale: 1, // Приходит ровно в масштаб 1
                opacity: 1,
                rotate: 0,
                filter: "blur(0px)",
                transition: enterTransition,
              }}
              exit={{
                scale: 2.2, // Мощно расширяется, пропуская следующую цифру вперед
                opacity: 0,
                rotate: 10,
                filter: "blur(12px)",
                transition: exitTransition,
              }}
            >
              {label}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}