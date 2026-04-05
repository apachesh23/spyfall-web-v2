"use client";

import type { MouseEvent } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { playUI, type UISoundId } from "@/lib/sound";
import styles from "./GlassPanelButton.module.css";

export type GlassPanelButtonProps = Omit<
  HTMLMotionProps<"button">,
  "children" | "onClick"
> & {
  children: React.ReactNode;
  onClick?: () => void;
  /** Высота строки: 60px (пункты меню) или 52px (опции языка) */
  size?: "md" | "sm";
  /** Выравнивание текста / контента */
  align?: "start" | "center";
  className?: string;
  soundClick?: UISoundId;
  soundHover?: UISoundId;
};

export function GlassPanelButton({
  children,
  onClick,
  size = "md",
  align = "start",
  className = "",
  soundClick = "click",
  soundHover = "hover",
  type = "button",
  disabled,
  onMouseEnter,
  ...rest
}: GlassPanelButtonProps) {
  const sizeClass = size === "sm" ? styles.sizeSm : styles.sizeMd;
  const alignClass = align === "center" ? styles.alignCenter : styles.alignStart;

  return (
    <motion.button
      type={type}
      disabled={disabled}
      className={`glass glass-hover ${styles.button} ${sizeClass} ${alignClass} ${className}`.trim()}
      onClick={() => {
        if (!disabled && soundClick) playUI(soundClick);
        onClick?.();
      }}
      onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
        if (!disabled && soundHover) playUI(soundHover);
        onMouseEnter?.(e);
      }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.08 }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
