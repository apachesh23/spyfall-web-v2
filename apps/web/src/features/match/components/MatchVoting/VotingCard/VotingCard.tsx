"use client";

import type { AvatarId } from "@/lib/avatars";
import { PlayerAvatar } from "@/features/player/components/PlayerAvatar";
import { LottieIcon } from "@/lib/lottie/LottieIcon";
import { playUI } from "@/lib/sound";
import styles from "./VotingCard.module.css";

export type VotingCardPlayer = {
  id: string;
  nickname: string;
  avatarId: number;
  isHost: boolean;
};

type VotingCardProps = {
  player: VotingCardPlayer;
  isMe: boolean;
  isHost: boolean;
  hasVoted: boolean;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  percentLabel?: string;
  dimmed?: boolean;
  /** Повторное голосование: красный = revoteA (V слева / сверху в колонке), синий = revoteB (S справа / снизу). */
  revoteTeam?: "red" | "blue";
};

export function VotingCard({
  player,
  isMe,
  isHost,
  hasVoted,
  selected,
  disabled,
  onSelect,
  percentLabel,
  dimmed,
  revoteTeam,
}: VotingCardProps) {
  const avatarId = (player.avatarId >= 1 && player.avatarId <= 16 ? player.avatarId : 1) as AvatarId;

  const surfaceClass =
    revoteTeam === "red"
      ? styles.cardGlassRevoteRed
      : revoteTeam === "blue"
        ? styles.cardGlassRevoteBlue
        : "glass glass-hover";

  return (
    <button
      type="button"
      className={`${surfaceClass} ${styles.card} ${selected ? styles.cardSelected : ""} ${disabled ? styles.cardDisabled : ""} ${dimmed ? styles.cardDimmed : ""}`}
      onClick={() => {
        if (disabled) return;
        playUI("click");
        onSelect();
      }}
      onMouseEnter={() => !disabled && playUI("hover")}
      disabled={disabled}
    >
      <div className={styles.avatarWrap}>
        <PlayerAvatar avatarId={avatarId} size="md" className={styles.avatar} />
      </div>
      <div className={styles.info}>
        <span className={styles.nameRow}>
          <span className={styles.nickname}>{player.nickname}</span>
          <span className={styles.labels}>
            {isHost ? (
              <span className={styles.crown} aria-hidden>
                <LottieIcon src="/lottie/crown.json" loop size={16} />
              </span>
            ) : null}
            {isMe ? (
              <span className={styles.you}>
                <LottieIcon src="/lottie/crystall.json" size={14} loop />
                <span>You</span>
              </span>
            ) : null}
          </span>
        </span>
      </div>
      <div className={styles.rightSlot}>
        {percentLabel != null ? (
          <span className={styles.percentLabel}>{percentLabel}</span>
        ) : hasVoted ? (
          <span className={styles.fistWrap} aria-hidden>
            <LottieIcon src="/lottie/fist.json" autoplayOnce size={32} />
          </span>
        ) : null}
      </div>
    </button>
  );
}
