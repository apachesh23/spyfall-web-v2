"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { VotingCard, type VotingCardPlayer } from "../VotingCard";
import {
  MATCH_VOTING_DECO_TABLET_MAX_WIDTH_PX,
  MATCH_VOTING_REVOTE_ENTRY_EASE,
  getRevoteCandidateCardsEntryDurationSec,
  matchVotingRevoteCandidateCardsForViewport,
  matchVotingRevoteVsConfig,
} from "../voting.config";
import styles from "./RevoteCandidateCardsRow.module.css";

export type RevoteCandidateCardsRowProps = {
  left: VotingCardPlayer;
  right: VotingCardPlayer;
  selfPlayerId?: string | null;
  centerSlot: ReactNode;
};

export function RevoteCandidateCardsRow({
  left,
  right,
  selfPlayerId,
  centerSlot,
}: RevoteCandidateCardsRowProps) {
  const reduceMotion = useReducedMotion();
  const isTabletOrNarrower = useMediaQuery(
    `(max-width: ${MATCH_VOTING_DECO_TABLET_MAX_WIDTH_PX}px)`,
  );
  const cardsCfg = matchVotingRevoteCandidateCardsForViewport({
    isTabletOrNarrower: isTabletOrNarrower,
  });
  const duration = getRevoteCandidateCardsEntryDurationSec(
    cardsCfg,
    matchVotingRevoteVsConfig,
  );
  const runAnim = !reduceMotion;
  const transition = {
    duration: runAnim ? duration : 0,
    ease: MATCH_VOTING_REVOTE_ENTRY_EASE,
  };
  const { offscreenXvw, offscreenYvh, entryAxis, fromOpacity } = cardsCfg;

  const leftInitial =
    entryAxis === "x"
      ? { x: `-${offscreenXvw}vw`, y: 0, opacity: fromOpacity }
      : { x: 0, y: `-${offscreenYvh}vh`, opacity: fromOpacity };
  const rightInitial =
    entryAxis === "x"
      ? { x: `${offscreenXvw}vw`, y: 0, opacity: fromOpacity }
      : { x: 0, y: `${offscreenYvh}vh`, opacity: fromOpacity };

  return (
    <div
      className={`${styles.revoteCardsRow}${
        isTabletOrNarrower ? ` ${styles.revoteCardsRowStacked}` : ""
      }`}
    >
      <motion.div
        className={styles.revoteCardMotion}
        initial={runAnim ? leftInitial : false}
        animate={{ x: 0, y: 0, opacity: 1 }}
        transition={transition}
      >
        <VotingCard
          player={left}
          isMe={left.id === selfPlayerId}
          isHost={left.isHost}
          hasVoted={false}
          selected={false}
          disabled
          onSelect={() => {}}
          revoteTeam="red"
        />
      </motion.div>
      <div className={styles.revoteVsMiddle}>{centerSlot}</div>
      <motion.div
        className={styles.revoteCardMotion}
        initial={runAnim ? rightInitial : false}
        animate={{ x: 0, y: 0, opacity: 1 }}
        transition={transition}
      >
        <VotingCard
          player={right}
          isMe={right.id === selfPlayerId}
          isHost={right.isHost}
          hasVoted={false}
          selected={false}
          disabled
          onSelect={() => {}}
          revoteTeam="blue"
        />
      </motion.div>
    </div>
  );
}
