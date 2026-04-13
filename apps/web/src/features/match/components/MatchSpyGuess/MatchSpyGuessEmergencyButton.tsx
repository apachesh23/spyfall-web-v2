"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { playVFX } from "@/lib/sound";
import styles from "./MatchSpyGuessEmergencyButton.module.css";

const BASE = "/spyguess/emergency_base.webp";
const BUTTON = "/spyguess/emergency_button.webp";
const MASK = "/spyguess/emergency_base_mask.webp";
const GLASS_CLOSE = "/spyguess/emergency_glass_close.webp";
const GLASS_OPEN = "/spyguess/emergency_glass_open.webp";

/** Длительность кроссфейда стекла (с) — держать в синхроне с `MatchSpyGuessEmergencyIntroLayer` (match). */
export const EMERGENCY_GLASS_CROSSFADE_SEC = 2;
const GLASS_CROSSFADE = { duration: EMERGENCY_GLASS_CROSSFADE_SEC, ease: [0.22, 1, 0.36, 1] as const };

const BUTTON_SLIDE_SPRING = { type: "spring" as const, stiffness: 360, damping: 26, mass: 2 };

/** Пауза после старта открытия стекла до анимации нажатия кнопки (мс). */
export const EMERGENCY_BUTTON_PRESS_DELAY_MS = 400;

/** Смещение `emergency_button.webp` от левого верхнего угла композиции (px). */
export const EMERGENCY_BUTTON_X_PX = 321;
export const EMERGENCY_BUTTON_Y_PX = 350;

/** Y в положении «нажато» — сдвиг вниз от `EMERGENCY_BUTTON_Y_PX` (px). */
export const EMERGENCY_BUTTON_Y_PUSHED_PX = 420;

export type MatchSpyGuessEmergencyButtonProps = {
  className?: string;
  /**
   * После прилёта контейнера: кроссфейд по opacity — close сверху гаснет, open под base проявляется.
   */
  glassReveal?: boolean;
};

/**
 * Визуальный слой «аварийной» кнопки: webp-слои, стекло — два кадра с кроссфейдом.
 */
const glassTransition = (revealed: boolean) =>
  revealed ? GLASS_CROSSFADE : { duration: 0, ease: "linear" as const };

export function MatchSpyGuessEmergencyButton({
  className = "",
  glassReveal = false,
}: MatchSpyGuessEmergencyButtonProps) {
  const [buttonPushed, setButtonPushed] = useState(false);
  const compositionRef = useRef<HTMLDivElement>(null);
  const [baseNatural, setBaseNatural] = useState<{ w: number; h: number } | null>(null);
  const [buttonNatural, setButtonNatural] = useState<{ w: number; h: number } | null>(null);
  const [layoutW, setLayoutW] = useState(0);
  const prevGlassReveal = useRef(glassReveal);
  const prevButtonPushed = useRef(buttonPushed);

  useEffect(() => {
    if (glassReveal && !prevGlassReveal.current) {
      playVFX("emergency_open");
    }
    prevGlassReveal.current = glassReveal;
  }, [glassReveal]);

  useEffect(() => {
    if (buttonPushed && !prevButtonPushed.current) {
      playVFX("emergency_press");
      playVFX("emergency_alarm");
    }
    prevButtonPushed.current = buttonPushed;
  }, [buttonPushed]);

  useLayoutEffect(() => {
    const el = compositionRef.current;
    if (!el || !baseNatural?.w) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setLayoutW(w);
    });
    ro.observe(el);
    setLayoutW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [baseNatural?.w]);

  useEffect(() => {
    if (!glassReveal) {
      setButtonPushed(false);
      return;
    }
    const id = window.setTimeout(() => setButtonPushed(true), EMERGENCY_BUTTON_PRESS_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [glassReveal]);

  /** Один масштаб для base, маски, стекла и кнопки: ширина композиции / натуральная ширина base. */
  const scale =
    layoutW > 0 && baseNatural && baseNatural.w > 0 ? layoutW / baseNatural.w : 1;

  const btnLeft = EMERGENCY_BUTTON_X_PX * scale;
  const btnTop = EMERGENCY_BUTTON_Y_PX * scale;
  const buttonSlideY = buttonPushed
    ? (EMERGENCY_BUTTON_Y_PUSHED_PX - EMERGENCY_BUTTON_Y_PX) * scale
    : 0;

  const buttonImgStyle: CSSProperties =
    buttonNatural && baseNatural && layoutW > 0
      ? {
          width: Math.max(1, Math.round(buttonNatural.w * scale)),
          height: "auto",
          display: "block",
        }
      : { visibility: "hidden" as const };

  return (
    <div className={`${styles.scene} ${className}`.trim()}>
      <div ref={compositionRef} className={styles.composition}>
        <motion.img
          className={styles.layerGlassOpen}
          src={GLASS_OPEN}
          alt=""
          decoding="async"
          draggable={false}
          initial={{ opacity: 0 }}
          animate={{ opacity: glassReveal ? 1 : 0 }}
          transition={glassTransition(glassReveal)}
        />
        <img
          className={styles.layerBaseAnchor}
          src={BASE}
          alt=""
          decoding="async"
          draggable={false}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w > 0 && h > 0) setBaseNatural({ w, h });
          }}
        />
        <motion.div
          className={styles.layerButtonWrap}
          style={{ left: btnLeft, top: btnTop }}
          initial={false}
          animate={{ y: buttonSlideY }}
          transition={BUTTON_SLIDE_SPRING}
        >
          <img
            className={styles.layerButton}
            src={BUTTON}
            alt=""
            decoding="async"
            draggable={false}
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              if (w > 0 && h > 0) setButtonNatural({ w, h });
            }}
            style={buttonImgStyle}
          />
        </motion.div>
        <img className={styles.layerMask} src={MASK} alt="" decoding="async" draggable={false} />
        <motion.img
          className={styles.layerGlassClose}
          src={GLASS_CLOSE}
          alt=""
          decoding="async"
          draggable={false}
          initial={{ opacity: 1 }}
          animate={{ opacity: glassReveal ? 0 : 1 }}
          transition={glassTransition(glassReveal)}
        />
      </div>
    </div>
  );
}
