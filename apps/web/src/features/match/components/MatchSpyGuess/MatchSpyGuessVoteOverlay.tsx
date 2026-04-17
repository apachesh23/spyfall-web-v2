"use client";

import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { MatchSpyGuessAutoWinContent } from "./MatchSpyGuessAutoWinContent";
import { MatchSpyGuessSplash } from "./MatchSpyGuessSplash";
import { MatchSpyGuessVoteContent } from "./MatchSpyGuessVoteContent";

export type MatchSpyGuessVoteOverlayProps = {
  open: boolean;
  guessText: string;
  spyGuessSpyId: string;
  /** Игроки, которые могут голосовать (живые, кроме угадывающего шпиона). */
  eligibleIds: string[];
  ballots: Record<string, string>;
  currentPlayerId: string;
  voteEndsAt: number;
  clockSkewMs: number;
  /** Точное совпадение с локацией — без кнопок голосования, только инфо + таймер. */
  isAutoWin?: boolean;
  voteStartsAtMs?: number;
  /** Сплэш под слоем Emergency, пока идёт exit-fall. */
  underEmergencyLayer?: boolean;
  /** До старта окна голосования на сервере — без кликов по Да/Нет. */
  votingLocked?: boolean;
  /** Секунд до `spyGuessVoteStartsAt` (синхрон с сервером). */
  voteOpensRemainSec?: number;
  onVote: (vote: "yes" | "no") => void;
};

export function MatchSpyGuessVoteOverlay({
  open,
  guessText,
  spyGuessSpyId,
  eligibleIds,
  ballots,
  currentPlayerId,
  voteEndsAt,
  clockSkewMs,
  isAutoWin = false,
  voteStartsAtMs = 0,
  underEmergencyLayer = false,
  votingLocked = false,
  voteOpensRemainSec = 0,
  onVote,
}: MatchSpyGuessVoteOverlayProps) {
  const isSpyGuesser = currentPlayerId === spyGuessSpyId;
  const canVote = !isSpyGuesser && eligibleIds.includes(currentPlayerId);
  const spectator = !isSpyGuesser && !canVote;

  const rawBallot = ballots[currentPlayerId];
  const myVote = rawBallot === "yes" || rawBallot === "no" ? rawBallot : null;

  const { yesCount, noCount } = useMemo(() => {
    let yes = 0;
    let no = 0;
    for (const id of eligibleIds) {
      const v = ballots[id];
      if (v === "yes") yes++;
      else if (v === "no") no++;
    }
    return { yesCount: yes, noCount: no };
  }, [eligibleIds, ballots]);

  return (
    <AnimatePresence>
      {open ? (
        <MatchSpyGuessSplash
          key="spy-guess-vote"
          title={isAutoWin ? "ТОЧНОЕ СОВПАДЕНИЕ" : "ШПИОН УГАДАЛ ?"}
          countdownLabel={isAutoWin ? "Игра завершена..." : "ВЫБЕРИТЕ ОТВЕТ..."}
          endsAtMs={voteEndsAt}
          clockSkewMs={clockSkewMs}
          voteStartsAtMs={voteStartsAtMs}
          underEmergencyLayer={underEmergencyLayer}
          holdAtZero
        >
          {isAutoWin ? (
            <MatchSpyGuessAutoWinContent guessText={guessText} />
          ) : (
            <MatchSpyGuessVoteContent
              guessText={guessText}
              yesCount={yesCount}
              noCount={noCount}
              myVote={myVote}
              isSpy={isSpyGuesser}
              spectator={spectator}
              votingLocked={votingLocked}
              voteOpensRemainSec={voteOpensRemainSec}
              onVote={onVote}
            />
          )}
        </MatchSpyGuessSplash>
      ) : null}
    </AnimatePresence>
  );
}
