"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Room } from "colyseus.js";
import { useEffect, useMemo, useState } from "react";
import { WS_CLIENT_MESSAGE } from "@spyfall/shared";
import { playUI } from "@/lib/sound";
import { MatchVoteRoot } from "../MatchVoteRoot";
import {
  MATCH_VOTING_COPY,
  type MatchVotingCenterPhase,
  type VoteStripeVariant,
} from "../voting.config";
import { VotingCard, type VotingCardPlayer } from "../VotingCard";
import type { MatchVoteRevoteCandidatesPair } from "../VotingPhaseRevoteCandidates";
import votingSplashStyles from "./MatchVotingOverlay.module.css";

export type MatchVotingOverlayPlayer = {
  id: string;
  nickname: string;
  avatarId: number;
  isHost: boolean;
};

export type MatchVotingOverlayProps = {
  active: boolean;
  /** После завершения exit `MatchVoteRoot` (полоски успевают сыграть OUT + fade корня). */
  onVotingRootExitComplete?: () => void;
  room: Room | null;
  voteStage: string;
  voteEndsAt: number;
  voteTransitionEndsAt: number;
  revoteA: string;
  revoteB: string;
  stubEliminatedId: string;
  playersById: Record<string, MatchVotingOverlayPlayer>;
  voteBallots: Record<string, string>;
  currentPlayerId: string;
  eliminatedPlayerIds: Set<string>;
  clockSkewMs: number;
  /** Сессия по таймеру 00:00 — без пропуска, ассеты final. */
  voteIsFinal?: boolean;
};

const SKIP = "skip";

/** Красный = revoteA (как слева на VS), синий = revoteB. Только раунд 2 / экран ничьей с парой. */
function revoteGlassTeam(
  voteStage: string,
  revoteA: string,
  revoteB: string,
  playerId: string,
): "red" | "blue" | undefined {
  const hasPair = Boolean(revoteA && revoteB);
  if (!hasPair) return undefined;
  if (voteStage === "collect2" || voteStage === "intermission_tie") {
    if (playerId === revoteA) return "red";
    if (playerId === revoteB) return "blue";
  }
  return undefined;
}

export function MatchVotingOverlay({
  active,
  onVotingRootExitComplete,
  room,
  voteStage,
  voteEndsAt,
  voteTransitionEndsAt,
  revoteA,
  revoteB,
  stubEliminatedId: _stubEliminatedId,
  playersById,
  voteBallots,
  currentPlayerId,
  eliminatedPlayerIds,
  clockSkewMs,
  voteIsFinal = false,
}: MatchVotingOverlayProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTarget(null);
  }, [voteStage, voteEndsAt]);

  const playerList = useMemo(() => Object.values(playersById), [playersById]);

  const isRevote = voteStage === "collect2";
  const candidateIds = isRevote && revoteA && revoteB ? [revoteA, revoteB] : null;

  const sendCast = (targetId: string) => {
    room?.send(WS_CLIENT_MESSAGE.voteCast, { targetId });
    setSelectedTarget(null);
  };

  const sendSkip = () => {
    room?.send(WS_CLIENT_MESSAGE.voteSkip, {});
    setSelectedTarget(null);
  };

  const showCollectTimer = voteStage === "collect1" || voteStage === "collect2";
  const endsAtIso =
    showCollectTimer && voteEndsAt > 0 ? new Date(voteEndsAt).toISOString() : undefined;

  const nowSync = Date.now() + clockSkewMs;
  const intermissionSecs =
    voteTransitionEndsAt > 0
      ? Math.max(0, Math.ceil((voteTransitionEndsAt - nowSync) / 1000) - 1)
      : 0;

  const toCardPlayer = (p: MatchVotingOverlayPlayer): VotingCardPlayer => ({
    id: p.id,
    nickname: p.nickname,
    avatarId: p.avatarId,
    isHost: p.isHost,
  });

  const canShowRevoteCandidatesLayout =
    voteStage === "intermission_tie" &&
    Boolean(revoteA && revoteB && playersById[revoteA] && playersById[revoteB]);

  const centerPhase: MatchVotingCenterPhase = (() => {
    if (voteStage === "intermission_no_vote" || voteStage === "intermission_revote_no_vote") {
      return "no_vote";
    }
    if (canShowRevoteCandidatesLayout) return "revote_candidates";
    return "vote";
  })();

  const revoteCandidatesPair: MatchVoteRevoteCandidatesPair | null =
    centerPhase === "revote_candidates"
      ? {
          left: toCardPlayer(playersById[revoteA]),
          right: toCardPlayer(playersById[revoteB]),
          selfPlayerId: currentPlayerId,
        }
      : null;

  const useRound1Marquee =
    voteStage === "collect1" || voteStage === "intermission_no_vote";

  const roundMarqueeLabel = useRound1Marquee
    ? MATCH_VOTING_COPY.round1
    : MATCH_VOTING_COPY.round2;

  const headlineMarqueeLabel = voteIsFinal ? MATCH_VOTING_COPY.finalVoting : MATCH_VOTING_COPY.voting;

  const voteStripeVariant: VoteStripeVariant = voteIsFinal ? "final" : "regular";

  const content = (() => {
    if (centerPhase === "no_vote" || centerPhase === "revote_candidates") {
      return null;
    }

    if (voteStage === "intermission_tie") {
      const pa = playersById[revoteA];
      const pb = playersById[revoteB];
      return (
        <div className={votingSplashStyles.votingCenter}>
          <p className={votingSplashStyles.votingMostVotes}>Ничья — повторное голосование между двумя игроками</p>
          <div className={votingSplashStyles.votingResultTwo}>
            {pa ? (
              <VotingCard
                player={toCardPlayer(pa)}
                isMe={pa.id === currentPlayerId}
                isHost={pa.isHost}
                hasVoted={false}
                selected={false}
                disabled
                onSelect={() => {}}
                revoteTeam={revoteGlassTeam(voteStage, revoteA, revoteB, pa.id)}
              />
            ) : null}
            {pb ? (
              <VotingCard
                player={toCardPlayer(pb)}
                isMe={pb.id === currentPlayerId}
                isHost={pb.isHost}
                hasVoted={false}
                selected={false}
                disabled
                onSelect={() => {}}
                revoteTeam={revoteGlassTeam(voteStage, revoteA, revoteB, pb.id)}
              />
            ) : null}
          </div>
        </div>
      );
    }

    if (voteStage === "collect1" || voteStage === "collect2") {
      const displayPlayers = [...playerList]
        .filter((p) => !eliminatedPlayerIds.has(p.id))
        .sort((a, b) => a.nickname.localeCompare(b.nickname));

      if (eliminatedPlayerIds.has(currentPlayerId)) {
        return (
          <div className={votingSplashStyles.votingCenter}>
            {displayPlayers.length > 0 ? (
              <div className={votingSplashStyles.votingList}>
                {displayPlayers.map((player) => {
                  const hasVoted =
                    voteBallots[player.id] !== undefined && voteBallots[player.id] !== "";
                  return (
                    <VotingCard
                      key={player.id}
                      player={toCardPlayer(player)}
                      isMe={false}
                      isHost={player.isHost}
                      hasVoted={hasVoted}
                      selected={false}
                      disabled
                      onSelect={() => {}}
                      revoteTeam={revoteGlassTeam(voteStage, revoteA, revoteB, player.id)}
                    />
                  );
                })}
              </div>
            ) : null}
            <p className={votingSplashStyles.votingDone}>
              Вы выбыли и не участвуете в этом голосовании. Дождитесь результата.
            </p>
          </div>
        );
      }

      const myBallot = voteBallots[currentPlayerId];
      const myResponded = myBallot !== undefined && myBallot !== "";
      const isCandidate = isRevote && candidateIds != null && candidateIds.includes(currentPlayerId);

      const revoteVoterIds =
        isRevote && candidateIds != null
          ? displayPlayers.map((p) => p.id).filter((id) => !candidateIds.includes(id))
          : null;
      const expectedRespondents =
        revoteVoterIds != null ? revoteVoterIds.length : displayPlayers.length;
      const respondedCount =
        revoteVoterIds != null
          ? revoteVoterIds.filter((id) => voteBallots[id] !== undefined && voteBallots[id] !== "").length
          : displayPlayers.filter((p) => voteBallots[p.id] !== undefined && voteBallots[p.id] !== "").length;

      return (
        <div className={votingSplashStyles.votingCenter}>
          <div className={votingSplashStyles.votingList}>
            {displayPlayers.map((player) => {
              const isSelf = player.id === currentPlayerId;
              const dimmed =
                isSelf || (isRevote && candidateIds != null && !candidateIds.includes(player.id));
              const hasVoted = voteBallots[player.id] !== undefined && voteBallots[player.id] !== "";
              const disabled = dimmed || myResponded || isCandidate;
              return (
                <VotingCard
                  key={player.id}
                  player={toCardPlayer(player)}
                  isMe={isSelf}
                  isHost={player.isHost}
                  hasVoted={hasVoted}
                  selected={!isSelf && selectedTarget === player.id}
                  disabled={disabled}
                  onSelect={() =>
                    !disabled && !isSelf && setSelectedTarget(selectedTarget === player.id ? null : player.id)
                  }
                  dimmed={dimmed}
                  revoteTeam={revoteGlassTeam(voteStage, revoteA, revoteB, player.id)}
                />
              );
            })}
          </div>
          {isCandidate ? (
            <p className={votingSplashStyles.votingDone}>
              Вы в числе кандидатов — голосование за вас ведут остальные. Ответили: {respondedCount} /{" "}
              {expectedRespondents}
            </p>
          ) : myResponded ? (
            <p className={votingSplashStyles.votingDone}>
              {myBallot === SKIP ? "Пропуск учтён." : "Голос учтён."} Ответили: {respondedCount} /{" "}
              {expectedRespondents}
            </p>
          ) : (
            <div
              className={`${votingSplashStyles.votingActions} ${voteIsFinal ? votingSplashStyles.votingActionsFinalOnly : ""}`.trim()}
            >
              {!voteIsFinal ? (
                <motion.button
                  type="button"
                  className={`glass glass-hover ${votingSplashStyles.skipBtn}`}
                  onClick={() => {
                    playUI("click");
                    sendSkip();
                  }}
                  onMouseEnter={() => playUI("hover")}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.08 }}
                >
                  ПРОПУСТИТЬ
                </motion.button>
              ) : null}
              <motion.button
                type="button"
                className={votingSplashStyles.voteBtn}
                onClick={() => {
                  if (selectedTarget) {
                    playUI("click");
                    sendCast(selectedTarget);
                  }
                }}
                onMouseEnter={() => playUI("hover")}
                disabled={
                  !selectedTarget ||
                  (isRevote && candidateIds != null && !candidateIds.includes(selectedTarget))
                }
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.08 }}
              >
                ПРОГОЛОСОВАТЬ
              </motion.button>
            </div>
          )}
        </div>
      );
    }

    return null;
  })();

  const resultPhases =
    voteStage === "intermission_no_vote" ||
    voteStage === "intermission_revote_no_vote" ||
    voteStage === "intermission_tie";

  const finalVotingNoOutcome =
    voteIsFinal &&
    (voteStage === "intermission_no_vote" || voteStage === "intermission_revote_no_vote");

  return (
    <AnimatePresence mode="wait" onExitComplete={onVotingRootExitComplete}>
      {active ? (
        <MatchVoteRoot
          /* Стабильный ключ: смена voteStage и таймеров только обновляет пропсы и фазы внутри корня,
           * без размонтирования — нижняя полоска/таймер не пересобираются с нуля на каждый этап. */
          key="match-voting-root"
          title={voteIsFinal ? MATCH_VOTING_COPY.finalVoting : "ГОЛОСОВАНИЕ"}
          titleBadge={isRevote ? "РАУНД 2" : undefined}
          centerPhase={centerPhase}
          revoteCandidates={revoteCandidatesPair}
          noVotePhaseTitle="Голосование не состоялось"
          noVotePhaseSubtitle={finalVotingNoOutcome ? MATCH_VOTING_COPY.finalAutoSpyWinSubtitle : undefined}
          roundMarqueeLabel={roundMarqueeLabel}
          headlineMarqueeLabel={headlineMarqueeLabel}
          voteStripeVariant={voteStripeVariant}
          countdownLabel="ОСТАЛОСЬ..."
          endsAt={endsAtIso}
          clockSkewMs={clockSkewMs}
          countdownSeconds={showCollectTimer ? undefined : 0}
          resultCountdown={resultPhases ? intermissionSecs : null}
          resultCountdownLabel={
            voteStage === "intermission_tie"
              ? MATCH_VOTING_COPY.revoteSubtitleLabel
              : finalVotingNoOutcome
                ? MATCH_VOTING_COPY.finalAutoSpyWinTimerStripLabel
                : voteStage === "intermission_no_vote" || voteStage === "intermission_revote_no_vote"
                  ? MATCH_VOTING_COPY.noVoteTimerStripLabel
                  : "Игра продолжается..."
          }
          colors={{ front: "#F3A221", back: "#B77918" }}
        >
          {content}
        </MatchVoteRoot>
      ) : null}
    </AnimatePresence>
  );
}
