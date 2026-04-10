"use client";

import { motion } from "framer-motion";
import { MATCH_VOTING_COPY } from "../voting.config";
import styles from "./VotingPhaseNoVote.module.css";

/** Контейнер для `AnimatePresence`: оборачивай в `motion.div` с этими `variants` + `initial`/`animate`/`exit`. */
export const noVotePhaseStackVariants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.065,
      staggerDirection: -1,
    },
  },
} as const;

export type VotingPhaseNoVoteProps = {
  title?: string;
  /** Вторая строка; `undefined` — `MATCH_VOTING_COPY.noVoteSubtitle`; `""` — скрыть. */
  subtitle?: string;
  /**
   * Доп. строка (тусклее); `undefined` / `""` — не показывать.
   */
  hint?: string;
  reduceMotion?: boolean | null;
};

const springIn = {
  type: "spring" as const,
  stiffness: 430,
  damping: 17,
  mass: 0.72,
};

const springInSoft = {
  type: "spring" as const,
  stiffness: 360,
  damping: 21,
  mass: 0.78,
};

const easeOutExit = [0.42, 0, 0.58, 1] as const;

function lineVariants(reduceMotion: boolean, spring: typeof springIn) {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.2 } },
      exit: { opacity: 0, transition: { duration: 0.18 } },
    };
  }
  return {
    initial: { opacity: 0, scale: 0 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: spring,
    },
    exit: {
      opacity: 0,
      scale: 0,
      transition: { duration: 0.22, ease: easeOutExit },
    },
  };
}

/**
 * Строки фазы «не состоялось» — прямые потомки `motion.div` с `noVotePhaseStackVariants` (см. `MatchVoteRoot`).
 */
export function VotingPhaseNoVote({
  title = MATCH_VOTING_COPY.noVoteTitle,
  subtitle,
  hint,
  reduceMotion = false,
}: VotingPhaseNoVoteProps) {
  const rm = !!reduceMotion;
  const resolvedSubtitle =
    subtitle === undefined ? MATCH_VOTING_COPY.noVoteSubtitle : subtitle;
  const showSubtitle = resolvedSubtitle.trim() !== "";
  const showHint = hint !== undefined && hint.trim() !== "";

  const titleMotion = lineVariants(rm, springIn);
  const subMotion = lineVariants(rm, springInSoft);
  const hintMotion = lineVariants(rm, springInSoft);

  return (
    <>
      <motion.h2 className={styles.phaseTitleNoVote} variants={titleMotion}>
        {title}
      </motion.h2>
      {showSubtitle ? (
        <motion.p className={styles.phaseSubtitleNoVote} variants={subMotion}>
          {resolvedSubtitle}
        </motion.p>
      ) : null}
      {showHint ? (
        <motion.p className={styles.phaseHintNoVote} variants={hintMotion}>
          {hint}
        </motion.p>
      ) : null}
    </>
  );
}
