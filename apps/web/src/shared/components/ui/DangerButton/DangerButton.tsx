"use client";

import { motion } from "framer-motion";
import { playUI, type UISoundId } from "@/lib/sound";
import styles from "./DangerButton.module.css";

type DangerButtonBase = {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  soundClick?: UISoundId;
  soundHover?: UISoundId;
};

export type DangerButtonTextProps = DangerButtonBase & {
  variant?: "text";
  /** Узкая кнопка (например «ВЫХОД» в шапке лобби) */
  compact?: boolean;
  children: React.ReactNode;
};

export type DangerButtonIconProps = DangerButtonBase & {
  variant: "icon";
  /** Обязательно для доступности */
  "aria-label": string;
  children: React.ReactNode;
};

export type DangerButtonProps = DangerButtonTextProps | DangerButtonIconProps;

export function DangerButton(props: DangerButtonProps) {
  const {
    onClick,
    disabled = false,
    className = "",
    soundClick,
    soundHover,
    children,
  } = props;

  const isIcon = props.variant === "icon";
  const compact = !isIcon && props.compact;

  const mergedClass = [
    styles.button,
    isIcon ? styles.buttonIcon : "",
    compact ? styles.buttonCompact : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <motion.button
      type="button"
      aria-label={isIcon ? props["aria-label"] : undefined}
      onClick={() => {
        if (!disabled && soundClick) playUI(soundClick);
        onClick?.();
      }}
      disabled={disabled}
      onMouseEnter={() => {
        if (!disabled && soundHover) playUI(soundHover);
      }}
      className={mergedClass}
      whileHover={
        disabled
          ? undefined
          : {
              filter: "brightness(1.08)",
            }
      }
      whileTap={
        disabled
          ? undefined
          : {
              scale: 0.97,
              filter: "brightness(0.93)",
            }
      }
      transition={{ duration: 0.08 }}
    >
      {children}
    </motion.button>
  );
}
