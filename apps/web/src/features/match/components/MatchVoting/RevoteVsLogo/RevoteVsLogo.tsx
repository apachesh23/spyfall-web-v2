"use client";

import type React from "react";
import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import {
  MATCH_VOTING_DECO_TABLET_MAX_WIDTH_PX,
  matchVotingRevoteVsForViewport,
  type MatchVotingRevoteVsConfig,
  MATCH_VOTING_REVOTE_ENTRY_EASE,
} from "../voting.config";
import styles from "./RevoteVsLogo.module.css";

export type RevoteVsLogoProps = {
  /** Без пропа — масштаб букв по брейкпоинту TABLET deco (планшет и уже `lettersScale: 1`). */
  config?: MatchVotingRevoteVsConfig;
};

/** Логотип VS (две буквы); при фазе revote может жить в общем вращающемся слое с затемнением. */
export function RevoteVsLogo({ config: configProp }: RevoteVsLogoProps = {}) {
  const isTabletOrNarrower = useMediaQuery(
    `(max-width: ${MATCH_VOTING_DECO_TABLET_MAX_WIDTH_PX}px)`,
  );
  const cfgMerged = useMemo(
    () => matchVotingRevoteVsForViewport({ isTabletOrNarrower }),
    [isTabletOrNarrower],
  );
  const cfg = configProp ?? cfgMerged;
  const reduceMotion = useReducedMotion();
  const entry = cfg.entryAnimation;
  const runEntry = Boolean(entry) && !reduceMotion;

  const anchorStyle = (xPx: number, yPx: number): React.CSSProperties => ({
    left: `calc(50% + ${xPx}px)`,
    top: `calc(50% + ${yPx}px)`,
    transform: "translate(-50%, -50%)",
  });

  const slideY = (fromYPx: number, finalYPx: number) =>
    runEntry && entry ? fromYPx - finalYPx : 0;

  return (
    <div
      className={styles.revoteVsComposition}
      style={{
        width: cfg.compositionWidthPx,
        height: cfg.compositionHeightPx,
        transform: `scale(${cfg.lettersScale})`,
        transformOrigin: "center center",
      }}
      aria-hidden
    >
      <div
        className={`${styles.revoteVsAnchor} ${styles.revoteVsAnchorV}`}
        style={anchorStyle(cfg.v.xPx, cfg.v.yPx)}
      >
        <motion.div
          initial={{ y: slideY(entry?.vFromYPx ?? cfg.v.yPx, cfg.v.yPx) }}
          animate={{ y: 0 }}
          transition={{
            duration: runEntry && entry ? entry.durationSec : 0,
            ease: MATCH_VOTING_REVOTE_ENTRY_EASE,
          }}
          style={{ display: "block", lineHeight: 0 }}
        >
          <img
            src={cfg.v.src}
            alt=""
            className={styles.revoteVsLetter}
            draggable={false}
          />
        </motion.div>
      </div>
      <div
        className={`${styles.revoteVsAnchor} ${styles.revoteVsAnchorS}`}
        style={anchorStyle(cfg.s.xPx, cfg.s.yPx)}
      >
        <motion.div
          initial={{ y: slideY(entry?.sFromYPx ?? cfg.s.yPx, cfg.s.yPx) }}
          animate={{ y: 0 }}
          transition={{
            duration: runEntry && entry ? entry.durationSec : 0,
            ease: MATCH_VOTING_REVOTE_ENTRY_EASE,
          }}
          style={{ display: "block", lineHeight: 0 }}
        >
          <img
            src={cfg.s.src}
            alt=""
            className={styles.revoteVsLetter}
            draggable={false}
          />
        </motion.div>
      </div>
    </div>
  );
}
