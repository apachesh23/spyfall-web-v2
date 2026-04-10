"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LottieIcon } from "@/lib/lottie";
import { playUI } from "@/lib/sound";
import styles from "./MatchHintQuestionBlock.module.css";

const FALLBACK_QUESTION = "Как часто ты обычно бываешь в таком месте?";

const CATEGORY_LABELS_RU: Record<string, string> = {
  actions: "Активность / действия",
  people: "Люди",
  space: "Пространство и интерьер",
  atmosphere: "Эмоциональная атмосфера",
  items: "Предметы / детали",
  restrictions: "Правила / ограничения",
  time: "Время",
  preparation: "Подготовка / Вход",
};

async function fetchHintQuestion(gameId: string | null | undefined): Promise<{
  text: string | null;
  category_key: string | null;
}> {
  if (gameId) {
    try {
      const res = await fetch("/api/game/hint-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      if (!res.ok) throw new Error("hint POST failed");
      const body = (await res.json()) as { text?: string | null; category_key?: string | null };
      if (typeof body?.text === "string") {
        return { text: body.text, category_key: body.category_key ?? null };
      }
    } catch {
      // GET fallback
    }
  }
  try {
    const res2 = await fetch("/api/game/hint-question");
    if (!res2.ok) throw new Error("hint GET failed");
    const body2 = (await res2.json()) as { text?: string | null; category_key?: string | null };
    return {
      text: typeof body2?.text === "string" ? body2.text : null,
      category_key: typeof body2?.category_key === "string" ? body2.category_key : null,
    };
  } catch {
    return { text: null, category_key: null };
  }
}

export type MatchHintQuestionBlockProps = {
  onClick?: () => void;
  /** UUID комнаты в Supabase (`rooms.id`) — пул вопросов без повторов внутри партии */
  gameId?: string | null;
  previewMode?: boolean;
};

/** Кнопка «Что спросить?» для мобильного футера (портал + оверлей). */
export function MatchHintQuestionButton({ gameId, onClick }: MatchHintQuestionBlockProps) {
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintCategoryKey, setHintCategoryKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setButtonRect(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    setButtonRect(rect);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setHintText(null);
    setHintCategoryKey(null);
    setLoading(true);
    void (async () => {
      const { text, category_key } = await fetchHintQuestion(gameId);
      if (!cancelled) {
        setHintText(text);
        setHintCategoryKey(category_key);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, gameId]);

  const handleToggle = () => {
    playUI("click");
    if (open) {
      setOpen(false);
      setIsClosing(true);
      onClick?.();
    } else {
      setOpen(true);
      onClick?.();
    }
  };

  const showCloseIcon = open || isClosing;

  const overlayPortal =
    typeof document !== "undefined" &&
    createPortal(
      <AnimatePresence>
        {open && (
          <div key="hint-overlay" className={styles.overlay}>
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleToggle}
            />
            <motion.div
              className={styles.popoverOverlay}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={
                buttonRect
                  ? {
                      bottom: window.innerHeight - buttonRect.top + 4,
                    }
                  : undefined
              }
            >
              <div className={`glass ${styles.popoverInner} ${styles.popoverInnerOverlay}`}>
                <p className={styles.categoryTitle}>
                  {loading
                    ? "…"
                    : hintCategoryKey
                      ? (CATEGORY_LABELS_RU[hintCategoryKey] ?? hintCategoryKey)
                      : ""}
                </p>
                <p className={styles.popoverText}>
                  «{loading ? "…" : (hintText ?? FALLBACK_QUESTION)}»
                </p>
              </div>
              <div className={styles.popoverArrow} aria-hidden />
            </motion.div>
            {buttonRect ? (
              <div
                className={styles.buttonAboveBackdrop}
                style={{
                  position: "fixed",
                  left: buttonRect.left,
                  top: buttonRect.top,
                  width: buttonRect.width,
                  height: buttonRect.height,
                }}
              >
                <motion.button
                  type="button"
                  className={`glass glass-hover ${styles.buttonSquare}`}
                  onMouseEnter={() => playUI("hover")}
                  onClick={handleToggle}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.08 }}
                >
                  {showCloseIcon ? (
                    <LottieIcon
                      key="close"
                      src="/lottie/question_close.json"
                      size={32}
                      playOnce={isClosing}
                      playSegment={isClosing ? [0, 40] : undefined}
                      loopSegment={open ? [60, 180] : undefined}
                      onComplete={() => setIsClosing(false)}
                    />
                  ) : (
                    <LottieIcon src="/lottie/question.json" size={32} loop />
                  )}
                </motion.button>
              </div>
            ) : null}
          </div>
        )}
      </AnimatePresence>,
      document.body,
    );

  return (
    <>
      {overlayPortal}
      <div
        ref={buttonRef}
        className={styles.root}
        style={open ? { visibility: "hidden" as const } : undefined}
      >
        <motion.button
          type="button"
          className={`glass glass-hover ${styles.buttonSquare}`}
          onMouseEnter={() => playUI("hover")}
          onClick={handleToggle}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.08 }}
        >
          {showCloseIcon ? (
            <LottieIcon
              key="close"
              src="/lottie/question_close.json"
              size={32}
              playOnce={isClosing}
              playSegment={isClosing ? [0, 40] : undefined}
              loopSegment={open ? [60, 180] : undefined}
              onComplete={() => setIsClosing(false)}
            />
          ) : (
            <LottieIcon src="/lottie/question.json" size={32} loop />
          )}
        </motion.button>
      </div>
    </>
  );
}

export function MatchHintQuestionBlock({
  onClick,
  gameId,
  previewMode = false,
}: MatchHintQuestionBlockProps) {
  const [hoveredBlock, setHoveredBlock] = useState(false);
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintCategoryKey, setHintCategoryKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setHintText(null);
    setHintCategoryKey(null);
    setLoading(true);
    void (async () => {
      const { text, category_key } = await fetchHintQuestion(gameId);
      if (!cancelled) {
        setHintText(text);
        setHintCategoryKey(category_key);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, gameId]);

  const handleToggle = () => {
    if (previewMode) return;

    playUI("click");
    if (open) {
      setOpen(false);
      setIsClosing(true);
      onClick?.();
    } else {
      setOpen(true);
      onClick?.();
    }
  };

  const handleCloseAnimationComplete = () => {
    setIsClosing(false);
  };

  const showCloseIcon = open || isClosing;

  return (
    <div className={`${styles.root} ${previewMode ? styles.rootPreview : ""}`}>
      <AnimatePresence>
        {open && !previewMode && (
          <>
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleToggle}
            />
            <motion.div
              className={styles.popover}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={`glass ${styles.popoverInner}`}>
                {hintCategoryKey ? (
                  <p className={styles.categoryTitle}>
                    {CATEGORY_LABELS_RU[hintCategoryKey] ?? hintCategoryKey}
                  </p>
                ) : null}
                <p className={styles.popoverText}>
                  «{loading ? "…" : (hintText ?? FALLBACK_QUESTION)}»
                </p>
              </div>
              <div className={styles.popoverArrow} aria-hidden />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.div
        className={`glass ${styles.wrap}`}
        onMouseEnter={() => setHoveredBlock(true)}
        onMouseLeave={() => setHoveredBlock(false)}
        whileHover={{ filter: "brightness(1.03)" }}
        transition={{ duration: 0.08 }}
      >
        <div className={styles.left}>
          <div className={styles.iconMain}>
            <LottieIcon
              src="/lottie/robot.json"
              size={40}
              playOnHover
              hovered={hoveredBlock}
            />
          </div>
          <div className={styles.textBlock}>
            <h2 className={styles.title}>ЧТО СПРОСИТЬ?</h2>
            <p className={styles.subtitle}>
              Если не можешь придумать вопрос&nbsp;— жми кнопку
            </p>
          </div>
        </div>
        <div className={styles.buttonWrap}>
          <motion.button
            type="button"
            className={`glass glass-hover ${styles.buttonSquare}`}
            onMouseEnter={() => {
              if (!previewMode) playUI("hover");
            }}
            onClick={handleToggle}
            whileTap={previewMode ? undefined : { scale: 0.95 }}
            transition={{ duration: 0.08 }}
          >
            {showCloseIcon ? (
              <LottieIcon
                key="close"
                src="/lottie/question_close.json"
                size={32}
                playOnce={isClosing}
                playSegment={isClosing ? [0, 40] : undefined}
                loopSegment={open ? [60, 180] : undefined}
                onComplete={isClosing ? handleCloseAnimationComplete : undefined}
              />
            ) : (
              <LottieIcon src="/lottie/question.json" size={32} loop />
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
