'use client';

import { useState, type CSSProperties, type MouseEvent } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { LottieIcon } from '@/lib/lottie';
import { playUI, type UISoundId } from '@/lib/sound';
import styles from './PrimaryButton.module.css';

const MotionLink = motion.create(Link);

function PlayIcon() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="#734517"
      aria-hidden
      style={{ display: 'block' }}
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#734517"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
      style={{ display: 'block' }}
    >
      <circle cx="12" cy="12" r="9" strokeDasharray="42 24" strokeDashoffset="0" />
    </svg>
  );
}

export type PrimaryButtonProps = {
  children: React.ReactNode;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
  /** Слот иконки справа: Lottie, спиннер при loading или play по умолчанию */
  withIcon?: boolean;
  lottieIcon?: string;
  className?: string;
  /** Например { '--btn-ratio': 7.5, '--btn-min-height': '56px' } */
  style?: CSSProperties;
  onClick?: (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  soundClick?: UISoundId;
  soundHover?: UISoundId;
  /** Если задан и кнопка не disabled — рендер как ссылка */
  href?: string;
  /** Узкая полоса (лобби ~80px): высота 60px, width: auto, запас под иконку справа */
  toolbar?: boolean;
  /** Вместе с toolbar: flex 1 в строке (низ лобби рядом с квадратной кнопкой) */
  toolbarExpand?: boolean;
};

export function PrimaryButton({
  children,
  type = 'button',
  disabled = false,
  loading = false,
  withIcon = true,
  lottieIcon,
  className = '',
  style,
  onClick,
  soundClick,
  soundHover,
  href,
  toolbar = false,
  toolbarExpand = false,
}: PrimaryButtonProps) {
  const [hovered, setHovered] = useState(false);
  const isDisabled = disabled || loading;
  const mergedClass = `${styles.button} ${toolbar ? styles.buttonToolbar : ""} ${toolbar && toolbarExpand ? styles.buttonToolbarExpand : ""} ${!withIcon ? styles.buttonNoIcon : ""} ${className}`.trim();

  const motionHover =
    isDisabled
      ? undefined
      : {
          filter: 'brightness(1.08)',
        };
  const motionTap =
    isDisabled
      ? undefined
      : {
          scale: 0.97,
          filter: 'brightness(0.93)',
        };

  const iconSlot =
    withIcon ? (
      <span className={styles.icon} aria-hidden>
        {loading ? (
          <span className={styles.spinner}>
            <SpinnerIcon />
          </span>
        ) : lottieIcon ? (
          <LottieIcon src={lottieIcon} playOnHover hovered={hovered} />
        ) : (
          <PlayIcon />
        )}
      </span>
    ) : null;

  const content = (
    <>
      {children}
      {iconSlot}
    </>
  );

  if (href && !isDisabled) {
    return (
      <MotionLink
        href={href}
        className={mergedClass}
        style={style}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (soundClick) playUI(soundClick);
          onClick?.(event);
        }}
        onMouseEnter={() => {
          setHovered(true);
          if (soundHover) playUI(soundHover);
        }}
        onMouseLeave={() => setHovered(false)}
        whileHover={motionHover}
        whileTap={motionTap}
        transition={{ duration: 0.08 }}
      >
        {content}
      </MotionLink>
    );
  }

  return (
    <motion.button
      type={type}
      className={mergedClass}
      style={style}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (!isDisabled && soundClick) playUI(soundClick);
        onClick?.(event);
      }}
      disabled={isDisabled}
      onMouseEnter={() => {
        setHovered(true);
        if (!isDisabled && soundHover) playUI(soundHover);
      }}
      onMouseLeave={() => setHovered(false)}
      whileHover={motionHover}
      whileTap={motionTap}
      transition={{ duration: 0.08 }}
    >
      {content}
    </motion.button>
  );
}
