"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconFlagFilled, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { playUI } from "@/lib/sound";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog/ConfirmDialog";
import styles from "./MatchGameHostButtons.module.css";

export type MatchGameHostButtonsProps = {
  isPaused: boolean;
  pausingGame: boolean;
  pauseDisabled?: boolean;
  onPause: () => void;
  onResume: () => void;
  onEndGame: () => void;
  /** `fixed` — портал слева по центру; `footer` — в футере/оверлее без портала */
  layout?: "fixed" | "footer";
};

export function MatchGameHostButtons({
  isPaused,
  pausingGame,
  pauseDisabled = false,
  onPause,
  onResume,
  onEndGame,
  layout: layoutProp = "fixed",
}: MatchGameHostButtonsProps) {
  const [endGameDialogOpen, setEndGameDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const wrapClass = layoutProp === "footer" ? styles.wrapFooter : styles.wrap;

  const tree = (
    <>
      <div className={wrapClass}>
        <motion.button
          type="button"
          className={`${styles.iconButton} glass glass-hover`}
          onClick={() => {
            playUI("click");
            if (isPaused) onResume();
            else onPause();
          }}
          onMouseEnter={() => playUI("hover")}
          disabled={pausingGame || pauseDisabled}
          aria-label={isPaused ? "Продолжить" : pauseDisabled ? "Пауза недоступна" : "Пауза"}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.08 }}
        >
          <span className={styles.icon} aria-hidden>
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={isPaused ? "play" : "pause"}
                className={styles.iconLayer}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {isPaused ? (
                  <IconPlayerPlay size={28} stroke={2} />
                ) : (
                  <IconPlayerPause size={28} stroke={2} />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.button>
        <motion.button
          type="button"
          className={`${styles.iconButton} ${styles.iconButtonEnd} glass glass-hover`}
          onClick={() => {
            playUI("click");
            setEndGameDialogOpen(true);
          }}
          onMouseEnter={() => playUI("hover")}
          aria-label="Завершить игру"
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.08 }}
        >
          <span className={styles.icon} aria-hidden>
            <IconFlagFilled size={28} stroke={2} />
          </span>
        </motion.button>
      </div>

      <ConfirmDialog
        open={endGameDialogOpen}
        onClose={() => setEndGameDialogOpen(false)}
        question="Вы хотите завершить игру?"
        onConfirm={onEndGame}
      />
    </>
  );

  if (layoutProp === "footer") {
    return tree;
  }

  /* Предок с `filter` (ч/б при паузе) ломает containing block у `position: fixed` — портал в body. */
  if (!mounted) {
    return null;
  }

  return createPortal(tree, document.body);
}
