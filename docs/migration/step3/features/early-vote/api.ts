import { gameApiFetch } from '@/lib/api/game';

export function toggleEarlyVote(roomId: string, playerId: string) {
  return gameApiFetch(
    '/api/game/early-vote/toggle',
    { roomId, playerId },
    { timeoutMs: 20_000 },
  );
}
