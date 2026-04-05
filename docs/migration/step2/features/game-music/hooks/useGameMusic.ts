'use client';

import { useEffect } from 'react';
import {
  startGameMusic, stopGameMusic,
  startVoteMusic, stopVoteMusic,
  syncMusicVolume,
} from '@/lib/sound';

type UseGameMusicParams = {
  votingSessionActive: boolean;
  isGameOverSplash: boolean;
  serverVotingPhase: string | null;
};

export function useGameMusic(params: UseGameMusicParams) {
  const { votingSessionActive, isGameOverSplash, serverVotingPhase } = params;

  // Start game music on mount, unlock audio on first interaction
  useEffect(() => {
    startGameMusic();

    const unlockAudio = () => {
      syncMusicVolume();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => syncMusicVolume(), 150);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopGameMusic();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Swap to vote music during voting session
  useEffect(() => {
    if (!votingSessionActive) {
      stopVoteMusic();
      startGameMusic();
      return;
    }
    stopGameMusic(false);
    return () => {
      stopVoteMusic();
      startGameMusic();
    };
  }, [votingSessionActive]);

  // Mute all music on game-over splash
  useEffect(() => {
    if (!isGameOverSplash) return;
    stopVoteMusic();
    stopGameMusic(false);
  }, [isGameOverSplash]);

  // Switch vote music variant based on server phase
  useEffect(() => {
    if (!votingSessionActive) return;
    if (serverVotingPhase === 'collecting') startVoteMusic('first');
    else if (serverVotingPhase === 'revote') startVoteMusic('revote');
  }, [votingSessionActive, serverVotingPhase]);
}
