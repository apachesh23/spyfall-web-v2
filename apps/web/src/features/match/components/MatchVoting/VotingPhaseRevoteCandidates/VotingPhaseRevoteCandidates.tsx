"use client";

import {
  MATCH_VOTING_COPY,
  matchVotingRevoteVsConfig,
} from "../voting.config";
import { RevoteVsLogo } from "../RevoteVsLogo";
import { RevoteCandidateCardsRow } from "../RevoteCandidateCardsRow";
import type { VotingCardPlayer } from "../VotingCard";
import styles from "./VotingPhaseRevoteCandidates.module.css";

export type MatchVoteRevoteCandidatesPair = {
  left: VotingCardPlayer;
  right: VotingCardPlayer;
  selfPlayerId?: string | null;
};

export type VotingPhaseRevoteCandidatesProps = {
  /** Без пропа — плейсхолдеры для вёрстки и превью. */
  candidates?: MatchVoteRevoteCandidatesPair | null;
};

const placeholderLeft = (): VotingCardPlayer => ({
  id: "__revote-placeholder-left",
  nickname: MATCH_VOTING_COPY.revoteCandidatePlaceholderLeft,
  avatarId: 1,
  isHost: false,
});

const placeholderRight = (): VotingCardPlayer => ({
  id: "__revote-placeholder-right",
  nickname: MATCH_VOTING_COPY.revoteCandidatePlaceholderRight,
  avatarId: 2,
  isHost: false,
});

export function VotingPhaseRevoteCandidates({
  candidates = null,
}: VotingPhaseRevoteCandidatesProps) {
  const vsInRotatingLayer = matchVotingRevoteVsConfig.rotation != null;
  const left = candidates?.left ?? placeholderLeft();
  const right = candidates?.right ?? placeholderRight();
  const selfPlayerId = candidates?.selfPlayerId ?? null;

  return (
    <div className={`${styles.phaseRoot} ${styles.phaseRootRevote}`}>
      <RevoteCandidateCardsRow
        left={left}
        right={right}
        selfPlayerId={selfPlayerId}
        centerSlot={vsInRotatingLayer ? null : <RevoteVsLogo />}
      />
    </div>
  );
}
