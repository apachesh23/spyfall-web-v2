"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PrimaryButton } from "@/shared/components/ui/PrimaryButton/PrimaryButton";
import { GlassPanelButton } from "@/shared/components/ui/GlassPanelButton/GlassPanelButton";
import { playUI, type UISoundId } from "@/lib/sound";
import styles from "./MatchSpyGuessLocationModal.module.css";

export type MatchSpyGuessLocationModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit?: (value: string) => void;
  soundClick?: UISoundId;
  soundHover?: UISoundId;
};

export function MatchSpyGuessLocationModal({
  open,
  onClose,
  onSubmit,
  soundClick = "click",
  soundHover = "hover",
}: MatchSpyGuessLocationModalProps) {
  const [value, setValue] = useState("");
  const [hasError, setHasError] = useState(false);

  const handleGuess = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      playUI("wrong");
      setHasError(true);
      return;
    }
    if (soundClick) playUI(soundClick);
    onSubmit?.(trimmed);
    setValue("");
    setHasError(false);
    onClose();
  }, [value, onSubmit, onClose, soundClick]);

  const handleCancel = useCallback(() => {
    if (soundClick) playUI(soundClick);
    setValue("");
    setHasError(false);
    onClose();
  }, [onClose, soundClick]);

  const handleBackdropClick = useCallback(() => {
    if (soundClick) playUI(soundClick);
    onClose();
  }, [onClose, soundClick]);

  useEffect(() => {
    if (open) {
      setValue("");
      setHasError(false);
    }
  }, [open]);

  /** Как у GlassPanelButton (14px): без clamp(…, 100cqw/24, 22px) у Primary — в широкой модалке текст раздувается. */
  const guessPrimaryStyle = {
    height: "60px",
    minHeight: "60px",
    maxHeight: "60px",
    "--btn-min-height": "60px",
    "--btn-ratio": "999",
    fontSize: "14px",
    letterSpacing: "0.1em",
  } as CSSProperties;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Угадать локацию"
        >
          <div className={styles.closeArea} onClick={handleBackdropClick} aria-hidden />

          <motion.div
            className={`glass ${styles.card}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <h2 className={styles.title}>Назовите локацию</h2>
              <p className={styles.hint}>Тратит 1 действие. Угадайте локацию</p>
            </div>

            <div className={styles.inputWrap}>
              <input
                id="spy-guess-input"
                type="text"
                className={`glass-input ${styles.input} ${hasError ? styles.inputError : ""}`}
                placeholder="Введите название локации..."
                value={value}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setValue(e.target.value);
                  if (hasError) setHasError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGuess();
                  if (e.key === "Escape") handleCancel();
                }}
                autoFocus
                autoComplete="off"
              />
            </div>

            <div className={styles.actions}>
              <PrimaryButton
                type="button"
                withIcon={false}
                className={styles.btnGuess}
                style={guessPrimaryStyle}
                onClick={handleGuess}
                soundClick={soundClick}
                soundHover={soundHover}
              >
                Угадать
              </PrimaryButton>

              <GlassPanelButton
                type="button"
                size="md"
                align="center"
                className={styles.btnCancel}
                onClick={handleCancel}
                soundClick={soundClick}
                soundHover={soundHover}
              >
                Отмена
              </GlassPanelButton>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
