import { gameApiFetch } from '@/lib/api/game';

export function submitGuess(roomId: string, playerId: string, guessText: string) {
  return gameApiFetch('/api/game/spy-guess', { roomId, playerId, guessText });
}

export function submitKill(roomId: string, spyId: string, targetId: string) {
  return gameApiFetch('/api/game/spy-kill', { roomId, spyId, targetId });
}

export function castSpyGuessVote(roomId: string, playerId: string, vote: 'yes' | 'no') {
  return gameApiFetch('/api/game/spy-guess/vote', { roomId, playerId, vote });
}

export function finishSpyGuess(roomId: string) {
  return gameApiFetch('/api/game/spy-guess/finish', { roomId });
}

export function ackAutoWin(roomId: string) {
  return gameApiFetch('/api/game/spy-guess/ack-auto-win', { roomId });
}
