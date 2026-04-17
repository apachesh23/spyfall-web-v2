import { DEFAULT_AVATAR_ID, isValidAvatarId } from "@/lib/avatars";
import type { Settings } from "@/types/room";

export type DbPlayerRow = {
  id: string;
  nickname: string;
  avatar_id: number;
  is_host: boolean | null;
};

export type DbLocationRow = {
  id: string;
  name: string;
  themes: string[] | null;
  roles: string[] | null;
  image_key: string | null;
};

export type MatchRosterRowJson = {
  id: string;
  nickname: string;
  avatarId: number;
  isHost: boolean;
  isSpy: boolean;
  roleAtLocation: string;
  spyCardUrl: string;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)] ?? null;
}

const SPY_CARDS = [
  "/locations/spy1.webp",
  "/locations/spy2.webp",
  "/locations/spy3.webp",
  "/locations/spy4.webp",
] as const;

/**
 * Готовит тело matchmake/create: ростер с ролями, локация, тема, таймер задаётся отдельно.
 */
export function buildMatchRoomOptions(
  matchSessionId: string,
  discussionDurationMs: number,
  players: DbPlayerRow[],
  location: DbLocationRow,
  settings: Settings,
): {
  matchSessionId: string;
  discussionDurationMs: number;
  votingDurationMs: number;
  roster: MatchRosterRowJson[];
  locationName: string;
  locationImageKey: string;
  themeText: string;
  modeTheme: boolean;
  modeRole: boolean;
  /** Режим «Скрытая угроза» из лобби (две кнопки шпиона + общий лимит с угадыванием). */
  modeHiddenThreat: boolean;
  spyPlayerIds: string[];
} {
  const list = players.filter((p) => p.id && p.nickname);
  if (list.length < 1) {
    throw new Error("Нет игроков для старта");
  }

  const n = list.length;
  let spyCount = 1;
  if (settings.mode_multi_spy) {
    if (n >= 5) spyCount = 3;
    else if (n >= 4) spyCount = 2;
    else spyCount = 1;
    if (settings.mode_spy_chaos) {
      spyCount = Math.floor(Math.random() * spyCount) + 1;
    }
  } else {
    spyCount = 1;
  }
  /** Автоподбор количества шпионов (для тестовых порогов), плюс clamp к n−1. */
  spyCount = Math.min(spyCount, Math.max(1, n - 1));

  const shuffledIds = shuffle(list.map((p) => p.id));
  const spySet = new Set(shuffledIds.slice(0, spyCount));
  const spyPlayerIds = [...spySet];

  const themes = Array.isArray(location.themes) ? location.themes.filter(Boolean) : [];
  const roles = Array.isArray(location.roles) ? location.roles.filter(Boolean) : [];

  const modeTheme = !!settings.mode_theme;
  const modeRole = !!settings.mode_roles;
  const modeHiddenThreat =
    !!settings.mode_hidden_threat && !settings.mode_multi_spy && spyCount === 1;
  const themeText =
    modeTheme && themes.length > 0 ? (pickRandom(themes) ?? "") : "";

  const shuffledRoles = shuffle(roles);
  const roleSlotOrder = shuffle(list.map((p) => p.id));

  const voteMin = typeof settings.vote_duration === "number" ? settings.vote_duration : 1;
  const votingDurationMs = Math.max(30_000, Math.min(600_000, Math.floor(voteMin * 60 * 1000)));

  const roster: MatchRosterRowJson[] = list.map((p) => {
    const avatarId = isValidAvatarId(p.avatar_id) ? p.avatar_id : DEFAULT_AVATAR_ID;
    const isSpy = spySet.has(p.id);
    let roleAtLocation = "";
    if (modeRole && shuffledRoles.length > 0) {
      const slot = roleSlotOrder.indexOf(p.id);
      roleAtLocation = shuffledRoles[slot % shuffledRoles.length] ?? "";
    }
    const spyCardUrl = isSpy ? SPY_CARDS[Math.floor(Math.random() * SPY_CARDS.length)]! : "";
    return {
      id: p.id,
      nickname: p.nickname.trim().slice(0, 48) || "Игрок",
      avatarId,
      isHost: !!p.is_host,
      isSpy,
      roleAtLocation,
      spyCardUrl,
    };
  });

  return {
    matchSessionId,
    discussionDurationMs,
    votingDurationMs,
    roster,
    locationName: location.name,
    locationImageKey: location.image_key?.trim() || "default",
    themeText,
    modeTheme,
    modeRole,
    modeHiddenThreat,
    spyPlayerIds,
  };
}
