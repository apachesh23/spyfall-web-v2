import { ApiError, gameApiFetch } from './game';

export function createRoom(body: { nickname: string; avatarId: number; settings?: Record<string, unknown> }) {
  return gameApiFetch<{ code: string; playerId: string }>('/api/rooms/create', body);
}

export function joinRoom(body: { code: string; nickname: string; avatarId: number }) {
  return gameApiFetch<{ playerId: string }>('/api/rooms/join', body);
}

export function leaveRoom(body: { roomId: string; playerId: string }) {
  return gameApiFetch('/api/rooms/leave', body);
}

export function closeRoom(body: { roomId: string; playerId: string }) {
  return gameApiFetch('/api/rooms/close', body);
}

export function kickPlayer(body: { roomId: string; hostId: string; targetId: string }) {
  return gameApiFetch('/api/rooms/kick', body);
}

export function saveRoomSettings(body: { roomId: string; playerId: string; settings: Record<string, unknown> }) {
  return gameApiFetch('/api/rooms/settings', body);
}

export function triggerSplash(body: { roomId: string; type: string; countdownSeconds?: number; countdownLabel?: string }) {
  return gameApiFetch('/api/rooms/splash', body);
}

export function dismissSplash(body: { roomId: string }) {
  return gameApiFetch('/api/rooms/splash/dismiss', body);
}

export { ApiError };
