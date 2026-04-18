"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LottieIcon } from "@/lib/lottie";
import { playUI } from "@/lib/sound";
import styles from "./MatchModeCard.module.css";

const VARIANT_CONFIG = {
  theme: {
    label: "ТЕМА",
    lottie: "/lottie/theme-location.json",
    desc: "Тему знают все, включая шпиона",
    emptyText: "Без темы",
  },
  location: {
    label: "ЛОКАЦИЯ",
    lottie: "/lottie/location.json",
    desc: "Ты агент — не выдай локацию шпиону",
    emptyText: "—",
  },
  role: {
    label: "РОЛЬ",
    lottie: "/lottie/role-location.json",
    desc: "Вживайся в роль на локации",
    emptyText: "Без роли",
  },
  operationTime: {
    label: "ВРЕМЯ ОПЕРАЦИИ",
    lottie: "/lottie/timer.json",
    desc: "Фактическое время обсуждения за партию",
    emptyText: "—",
  },
} as const;

export type MatchModeCardVariant = keyof typeof VARIANT_CONFIG;

type MatchModeCardProps = {
  variant: MatchModeCardVariant;
  value: string;
  noGlass?: boolean;
  className?: string;
};

const transition = { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };

export function MatchModeCard({ variant, value, noGlass, className }: MatchModeCardProps) {
  const [hovered, setHovered] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const config = VARIANT_CONFIG[variant];
  const isEmpty = !value?.trim();
  const displayValue = isEmpty ? config.emptyText : value;
  const isSemiTransparent = (variant === "theme" || variant === "role") && isEmpty;

  return (
    <div
      className={`${noGlass ? "" : "glass glass-hover"} ${styles.card} ${noGlass ? styles.cardFill : ""} ${isSemiTransparent ? styles.cardEmpty : ""} ${className ?? ""}`.trim()}
      onMouseEnter={() => {
        if (isTouch) return;
        setHovered(true);
        playUI("hover");
      }}
      onMouseLeave={() => {
        if (isTouch) return;
        setHovered(false);
      }}
      onClick={() => {
        if (!isTouch) return;
        setHovered((prev) => !prev);
        playUI("click");
      }}
    >
      <div className={styles.lottieWrap}>
        <LottieIcon src={config.lottie} playOnHover hovered={hovered} size={40} />
      </div>
      <div className={styles.content}>
        <motion.span
          className={`${styles.line} ${styles.lineTitle}`}
          animate={{ y: hovered ? -35 : 0, opacity: hovered ? 0 : 1 }}
          transition={transition}
        >
          <span className={styles.label}>{config.label}:</span>{" "}
          <span className={styles.value}>{displayValue}</span>
        </motion.span>
        <motion.span
          className={`${styles.line} ${styles.lineDesc}`}
          initial={{ y: 35, opacity: 0 }}
          animate={{ y: hovered ? 0 : 35, opacity: hovered ? 1 : 0 }}
          transition={transition}
        >
          {config.desc}
        </motion.span>
      </div>
    </div>
  );
}
