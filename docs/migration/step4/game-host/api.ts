import { gameApiFetch } from '@/lib/api/game';

export function pauseGame(roomId: string, hostId: string) {
  return gameApiFetch('/api/game/pause', { roomId, hostId });
}

export function resumeGame(roomId: string, hostId: string) {
  return gameApiFetch('/api/game/resume', { roomId, hostId });
}

export function endGame(roomId: string, hostId: string) {
  return gameApiFetch<{ shareHash?: string; roomCode?: string }>(
    '/api/game/end',
    { roomId, hostId },
  );
}

export function clearSplash(roomId: string) {
  return gameApiFetch('/api/game/splash/clear', { roomId });
}
