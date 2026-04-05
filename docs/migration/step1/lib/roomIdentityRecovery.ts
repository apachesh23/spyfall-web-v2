/**
 * Резервная привязка игрока к комнате на время перехода на /summary и обратно.
 * localStorage иногда пустеет (ITP, ошибки запросов, гонки); sessionStorage обычно переживает навигацию в пределах вкладки.
 */
const sessionKey = (roomCode: string) => `spyfall_recover_player_${roomCode}`;

export function stashRoomPlayerForRecovery(roomCode: string, playerId: string): void {
  if (typeof window === 'undefined' || !roomCode || !playerId) return;
  try {
    window.sessionStorage.setItem(sessionKey(roomCode), playerId);
  } catch {
    /* quota / private mode */
  }
}

export function clearStashedRoomPlayer(roomCode: string): void {
  if (typeof window === 'undefined' || !roomCode) return;
  try {
    window.sessionStorage.removeItem(sessionKey(roomCode));
  } catch {
    /* */
  }
}

/** Только читает stash (очистка после успешной проверки в БД). */
export function peekStashedRoomPlayer(roomCode: string): string | null {
  if (typeof window === 'undefined' || !roomCode) return null;
  try {
    return window.sessionStorage.getItem(sessionKey(roomCode));
  } catch {
    return null;
  }
}
