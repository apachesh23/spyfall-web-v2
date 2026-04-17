"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { AvatarId } from "@/lib/avatars";
import { SplashScreen, type SplashType } from "@/features/splash-screen";

type SplashLayerPlayer = {
  id: string;
  nickname: string;
  avatarId: number;
  isSpy: boolean;
  eliminated?: boolean;
};

/** Типы сплэшей Colyseus — общий список для слоя и для `syncPlayPageMusicForState` (фон во время сплэша). */
export const MATCH_COLYSEUS_SPLASH_TYPES = new Set<string>([
  "voting_kicked_civilian",
  "game_over_spy_win",
  "game_over_spy_win_voting",
  "game_over_civilians_win",
  "spy_kill",
]);

const SPLASH_TYPES = MATCH_COLYSEUS_SPLASH_TYPES;

const VICTORY_SPLASH_TYPES = new Set<string>([
  "game_over_spy_win",
  "game_over_spy_win_voting",
  "game_over_civilians_win",
]);

export type MatchColyseusSplashLayerProps = {
  matchSplashType: string;
  matchSplashAt: number;
  matchSplashEndsAt: number;
  matchSplashEliminatedId: string;
  matchSplashVotePercent: number;
  matchSplashEliminationGameOver: boolean;
  guessedSpyId?: string;
  players: Record<string, SplashLayerPlayer>;
  clockSkewMs: number;
  /** Из state комнаты; для победы мирных — подпись при 2–3 шпионах в игре. */
  initialSpyCount?: number;
  isMatchHost?: boolean;
  onVictoryHostEndGame?: () => void;
  victoryEndGameBusy?: boolean;
};

function isSplashType(t: string): t is SplashType {
  return SPLASH_TYPES.has(t);
}

export function MatchColyseusSplashLayer({
  matchSplashType,
  matchSplashAt,
  matchSplashEndsAt,
  matchSplashEliminatedId,
  matchSplashVotePercent,
  matchSplashEliminationGameOver,
  guessedSpyId,
  players,
  clockSkewMs,
  initialSpyCount,
  isMatchHost = false,
  onVictoryHostEndGame,
  victoryEndGameBusy = false,
}: MatchColyseusSplashLayerProps) {
  if (!matchSplashType || !isSplashType(matchSplashType)) {
    return null;
  }

  const playerList = Object.values(players).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    avatar_id: p.avatarId as AvatarId,
    is_spy: p.isSpy,
    eliminated: p.eliminated === true,
  }));
  const spyIds = Object.values(players)
    .filter((p) => p.isSpy)
    .map((p) => p.id);

  const eliminated =
    (matchSplashType === "voting_kicked_civilian" || matchSplashType === "spy_kill") &&
    matchSplashEliminatedId
      ? players[matchSplashEliminatedId]
      : undefined;

  const endsAtIso =
    matchSplashEndsAt > 0 ? new Date(matchSplashEndsAt).toISOString() : undefined;
  const eventAtIso = matchSplashAt > 0 ? new Date(matchSplashAt).toISOString() : undefined;

  const eliminationCountdownLabel =
    matchSplashType === "voting_kicked_civilian"
      ? matchSplashEliminationGameOver
        ? "Игра завершена..."
        : "Игра продолжается..."
      : undefined;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${matchSplashType}-${matchSplashAt}`}
        style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "auto" }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <SplashScreen
          type={matchSplashType}
          endsAt={endsAtIso}
          eventAt={eventAtIso}
          clockSkewMs={clockSkewMs}
          countdownLabel={
            matchSplashType === "voting_kicked_civilian" ? eliminationCountdownLabel : undefined
          }
          players={playerList}
          spyIds={spyIds}
          guessedSpyId={guessedSpyId}
          eliminatedPlayer={
            eliminated
              ? {
                  nickname: eliminated.nickname,
                  avatar_id: eliminated.avatarId as AvatarId,
                }
              : undefined
          }
          eliminatedWasSpy={eliminated?.isSpy === true}
          eliminatedVotePercent={
            matchSplashType === "voting_kicked_civilian" ? matchSplashVotePercent : undefined
          }
          onVictoryHostEndGame={
            isMatchHost && VICTORY_SPLASH_TYPES.has(matchSplashType)
              ? onVictoryHostEndGame
              : undefined
          }
          victoryEndGameBusy={victoryEndGameBusy}
          initialSpyCount={initialSpyCount}
        />
      </motion.div>
    </AnimatePresence>
  );
}
