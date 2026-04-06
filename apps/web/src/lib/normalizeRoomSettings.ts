import type { Settings } from "@/types";

function truthyFlag(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t === "true" || t === "1" || t === "yes";
  }
  return Boolean(v);
}

/**
 * Приводит сырой объект настроек из БД к типу Settings.
 * Игнорирует устаревшие поля, задаёт дефолты, сохраняет max_players.
 */
export function normalizeRoomSettings(raw: unknown): Settings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const modeTheme = truthyFlag(
    s.match_display_theme ?? s.mode_theme ?? s.modeTheme,
  );
  const modeRoles = truthyFlag(
    s.match_display_roles ?? s.mode_roles ?? s.modeRoles,
  );
  return {
    colyseus_room_id: typeof s.colyseus_room_id === "string" ? s.colyseus_room_id : undefined,
    match_debug: truthyFlag(s.match_debug) ? true : undefined,
    match_theme_snapshot:
      typeof s.match_theme_snapshot === "string" && s.match_theme_snapshot.trim()
        ? s.match_theme_snapshot.trim()
        : undefined,
    game_duration: typeof s.game_duration === "number" ? s.game_duration : 15,
    vote_duration: typeof s.vote_duration === "number" ? s.vote_duration : 1,
    spy_count: typeof s.spy_count === "number" ? Math.max(1, Math.min(3, s.spy_count)) : 1,
    mode_roles: modeRoles,
    mode_theme: modeTheme,
    mode_multi_spy: !!s.mode_multi_spy,
    mode_spy_chaos: !!s.mode_spy_chaos,
    mode_hidden_threat: !!s.mode_hidden_threat,
    max_players:
      typeof s.max_players === "number" ? Math.max(3, Math.min(20, s.max_players)) : undefined,
  };
}
