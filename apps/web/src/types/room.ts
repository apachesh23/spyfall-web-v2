// src/types/room.ts

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export type Settings = {
  /** Заполняется при старте матча; все клиенты делают joinById в одну Colyseus-комнату (без гонки joinOrCreate). */
  colyseus_room_id?: string;
  /** Снимок лобби на момент старта — для экрана матча, пока идёт игра. */
  match_display_theme?: boolean;
  match_display_roles?: boolean;
  /** Текст темы на момент старта (дубль Colyseus, если снапшот состояния не подтянулся). */
  match_theme_snapshot?: string;
  /** Ведущий стартовал матч с отладкой — клиенты редиректят на `/play/...?matchDebug=1`. Сбрасывается при завершении матча. */
  match_debug?: boolean;
  spy_count: number; // 1 | 2 | 3 — фиксированное или макс. при хаосе
  game_duration: number;
  vote_duration: number;
  mode_roles: boolean;
  mode_theme: boolean;
  mode_multi_spy: boolean; // Сеть шпионов: 7–10 → 2 шпиона, 11+ → 3
  mode_spy_chaos: boolean; // только при mode_multi_spy: случайно 1..spy_count
  mode_hidden_threat: boolean; // только при 1 шпионе (без multi spy)
  max_players?: number;
};

export type Room = {
  id: string;
  code: string;
  host_id: string;
  status: RoomStatus;
  settings: Settings;
  location_id?: string;
  selected_theme?: string | null;
  spy_ids?: string[];
  game_started_at?: string;
  game_ends_at?: string;
  created_at: string;
  updated_at: string;
};