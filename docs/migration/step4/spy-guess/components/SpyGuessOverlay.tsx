'use client';

import { AnimatePresence } from 'framer-motion';
import { SpyGuessSplash } from './SpyGuessSplash';
import { SpyGuessAutoWinContent } from './SpyGuessAutoWinContent';
import { SpyGuessVoteContent } from './SpyGuessVoteContent';
import type { GamePlayer } from '@/types';

type SpyGuessOverlayProps = {
  spyGuessStatus: string | null;
  spyGuessText: string | null;
  spyGuessEndsAt: string | null;
  isSpy: boolean;
  alivePlayers: GamePlayer[];
  spyGuess: {
    yesCount: number;
    noCount: number;
    myVote: 'yes' | 'no' | null;
    handleAutoWinClose: () => void;
    onSpyGuessVoteTimeExpired: () => void;
    castVote: (vote: 'yes' | 'no') => void;
  };
};

export function SpyGuessOverlay(props: SpyGuessOverlayProps) {
  const {
    spyGuessStatus, spyGuessText, spyGuessEndsAt, isSpy, alivePlayers,
    spyGuess,
  } = props;

  return (
    <AnimatePresence>
      {spyGuessStatus === 'auto_win' && spyGuessText && spyGuessEndsAt && (
        <SpyGuessSplash
          key="spy-guess-autowin"
          title="ШПИОН УГАДАЛ ?"
          countdownLabel="Игра завершена..."
          endsAt={spyGuessEndsAt}
          onClose={spyGuess.handleAutoWinClose}
        >
          <SpyGuessAutoWinContent guessText={spyGuessText} />
        </SpyGuessSplash>
      )}
      {spyGuessStatus === 'voting' && spyGuessText && (
        <SpyGuessSplash
          key="spy-guess-vote"
          title="ШПИОН УГАДАЛ ?"
          countdownLabel="ВЫБЕРИТЕ ОТВЕТ..."
          endsAt={spyGuessEndsAt ?? undefined}
          onClose={spyGuess.onSpyGuessVoteTimeExpired}
        >
          <SpyGuessVoteContent
            guessText={spyGuessText}
            yesCount={spyGuess.yesCount}
            noCount={spyGuess.noCount}
            eligibleCount={alivePlayers.filter((p) => !p.is_spy).length}
            myVote={spyGuess.myVote}
            isSpy={isSpy}
            onVote={spyGuess.castVote}
          />
        </SpyGuessSplash>
      )}
    </AnimatePresence>
  );
}
