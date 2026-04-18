/**
 * Прод: при включённой «Сети шпионов» (без хаоса) — 4–6 игроков: 1 шпион; 7–10: 2; 11+: 3.
 * Должно совпадать с логикой лобби и `buildMatchRoomOptions`.
 */
export function multiSpyCountForPlayerCount(playerCount: number): number {
  if (playerCount >= 11) return 3;
  if (playerCount >= 7) return 2;
  return 1;
}

/** Включать «Сеть шпионов» в лобби имеет смысл только когда режим даёт ≥2 шпионов (сейчас с 7 игроков). */
export function isMultiSpyNetworkSelectable(playerCount: number): boolean {
  return multiSpyCountForPlayerCount(playerCount) >= 2;
}
