"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { playVFX } from "@/lib/sound";
import { MatchSpyGuessEmergencyButton } from "./MatchSpyGuessEmergencyButton";
import styles from "./MatchSpyGuessEmergencyIntroLayer.module.css";

/** Только ось Y — мягче, без резкого отскока. */
const FLY_SPRING = { type: "spring" as const, stiffness: 185, damping: 32, mass: 1.18 };

/**
 * Пауза перед стартом вылета композиции (с).
 * `emergency_hit` играет сразу при открытии оверлея, без этой задержки.
 */
export const EMERGENCY_INTRO_FLY_DELAY_MS = 50;

const FLY_TRANSITION = { ...FLY_SPRING, delay: EMERGENCY_INTRO_FLY_DELAY_MS / 1000 };

/**
 * Стартовый translateY: высота самого блока + запас по viewport — с центрированного flex
 * весь слот оказывается под нижним краем экрана (не видно «верх композиции» внизу).
 */
export const EMERGENCY_INTRO_FLY_START_Y = "calc(100% + 52vh)";

/** Падение при закрытии: ускорение вниз + лёгкий наклон от якоря справа сверху + fade. */
const FALL_TRANSITION = { duration: 0.58, ease: [0.48, 0.02, 0.78, 0.98] as const };

/** `preview` — тап/Esc закрывают; `match` — только автосценарий после стекла + паузы, затем exit-fall. */
export type MatchSpyGuessEmergencyIntroVariant = "preview" | "match";

export type MatchSpyGuessEmergencyIntroLayerProps = {
  open: boolean;
  onClose: () => void;
  variant?: MatchSpyGuessEmergencyIntroVariant;
  /** Только `variant="match"`: в тот же кадр, что и старт exit-fall (для Splash под слоём). */
  onExitFallStart?: () => void;
  /** Только `variant="match"`: после exit-fall (вместо `onClose`, если задан). */
  onMatchCinematicComplete?: () => void;
  /** Заменить дефолтную композицию кнопки (для превью кастома). */
  children?: ReactNode;
  /** Подсказка внизу (например dev). `null` — без строки. */
  hint?: string | null;
};

/**
 * После `glassReveal`: фиксированное окно (не привязано к `EMERGENCY_GLASS_CROSSFADE_SEC` в кнопке) + пауза 1 с,
 * затем одновременно exit-fall Emergency и появление Splash.
 */
const MATCH_AFTER_GLASS_MS = 1000;
const MATCH_PAUSE_AFTER_COMPOSITION_MS = 500;

export function MatchSpyGuessEmergencyIntroLayer({
  open,
  onClose,
  variant = "preview",
  onExitFallStart,
  onMatchCinematicComplete,
  children,
  hint = "Тап по фону или Esc — закрыть",
}: MatchSpyGuessEmergencyIntroLayerProps) {
  const [glassReveal, setGlassReveal] = useState(false);
  const [exitFall, setExitFall] = useState(false);
  const flyDoneRef = useRef(false);
  const flyHitPlayedRef = useRef(false);
  const closeAfterFallRef = useRef(false);
  const exitFallStartReportedRef = useRef(false);

  const startExitFall = useCallback(() => {
    setExitFall((prev) => {
      if (prev) return prev;
      playVFX("emergency_swoosh");
      return true;
    });
  }, []);

  useEffect(() => {
    if (!open) {
      flyHitPlayedRef.current = false;
      return;
    }
    if (flyHitPlayedRef.current) return;
    flyHitPlayedRef.current = true;
    playVFX("emergency_hit");
  }, [open]);

  useEffect(() => {
    if (!open || variant === "match") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      startExitFall();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, variant, startExitFall]);

  useEffect(() => {
    if (variant !== "match" || !glassReveal || exitFall) return;
    const id = window.setTimeout(
      () => startExitFall(),
      MATCH_AFTER_GLASS_MS + MATCH_PAUSE_AFTER_COMPOSITION_MS,
    );
    return () => window.clearTimeout(id);
  }, [variant, glassReveal, exitFall, startExitFall]);

  useLayoutEffect(() => {
    if (!exitFall || variant !== "match" || !onExitFallStart) return;
    if (exitFallStartReportedRef.current) return;
    exitFallStartReportedRef.current = true;
    onExitFallStart();
  }, [exitFall, variant, onExitFallStart]);

  useEffect(() => {
    if (open) {
      flyDoneRef.current = false;
      closeAfterFallRef.current = false;
      exitFallStartReportedRef.current = false;
      setExitFall(false);
      setGlassReveal(false);
    }
  }, [open]);

  const content =
    children ?? <MatchSpyGuessEmergencyButton glassReveal={glassReveal} />;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="spy-guess-emergency-intro"
          role="presentation"
          className={styles.overlay}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.22 } }}
        >
          {variant === "match" ? (
            <div className={styles.backdropInert} aria-hidden />
          ) : (
            <button
              type="button"
              className={styles.backdropButton}
              aria-label="Закрыть"
              onClick={startExitFall}
            />
          )}
          <div className={styles.center}>
            <motion.div
              className={styles.flySlot}
              style={{ transformOrigin: "100% 0" }}
              initial={{
                y: EMERGENCY_INTRO_FLY_START_Y,
                x: 0,
                rotateZ: 0,
                rotateX: 0,
                opacity: 1,
              }}
              animate={
                exitFall
                  ? {
                      y: "calc(85vh + 55%)",
                      x: "-6vmin",
                      rotateZ: 24,
                      rotateX: 14,
                      opacity: 0,
                    }
                  : {
                      y: 0,
                      x: 0,
                      rotateZ: 0,
                      rotateX: 0,
                      opacity: 1,
                    }
              }
              transition={exitFall ? FALL_TRANSITION : FLY_TRANSITION}
              onAnimationComplete={() => {
                if (exitFall) {
                  if (closeAfterFallRef.current) return;
                  closeAfterFallRef.current = true;
                  if (variant === "match" && onMatchCinematicComplete) {
                    onMatchCinematicComplete();
                  } else {
                    onClose();
                  }
                  return;
                }
                if (!open || flyDoneRef.current) return;
                flyDoneRef.current = true;
                setGlassReveal(true);
              }}
            >
              {content}
            </motion.div>
          </div>
          {hint ? <p className={styles.hint}>{hint}</p> : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
