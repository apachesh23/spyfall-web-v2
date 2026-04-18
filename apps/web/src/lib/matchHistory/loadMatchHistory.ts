import { supabaseAdmin } from "@/lib/supabase/server";

export type MatchHistoryPayloadPlayer = {
  id?: string;
  nickname: string;
  avatar_id?: number | null;
  is_spy?: boolean;
  role?: string | null;
  death_reason?: string | null;
};

export type MatchHistoryRecord = {
  share_hash: string;
  winner: string;
  game_end_reason: string;
  location_name: string;
  theme_text: string;
  mode_theme: boolean;
  mode_role: boolean;
  mode_hidden_threat: boolean;
  discussion_elapsed_ms: number;
  /** Код лобби из `rooms.code` (join по `room_id`); для кнопки «В лобби» без `?room=` в URL */
  lobby_room_code?: string | null;
  payload: {
    players?: MatchHistoryPayloadPlayer[];
    events?: Array<{
      at?: string;
      t?: number | null;
      type: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?: any;
    }>;
  };
};

type MatchHistoryDbRow = MatchHistoryRecord & {
  rooms?: { code: string } | { code: string }[] | null;
};

function lobbyCodeFromRoomsJoin(rooms: MatchHistoryDbRow["rooms"]): string | null {
  if (!rooms) return null;
  const row = Array.isArray(rooms) ? rooms[0] : rooms;
  const code = row?.code?.trim();
  return code || null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidShareHash(hash: string): boolean {
  return UUID_RE.test(hash.trim());
}

export async function loadMatchHistoryByShareHash(
  hash: string,
): Promise<{ row: MatchHistoryRecord | null; error: string | null }> {
  const h = hash.trim();
  if (!isValidShareHash(h)) {
    return { row: null, error: "invalid_hash" };
  }

  let res = await supabaseAdmin
    .from("match_history")
    .select("*, rooms ( code )")
    .eq("share_hash", h)
    .maybeSingle();

  if (res.error) {
    console.warn("loadMatchHistoryByShareHash (join rooms):", res.error.message);
    res = await supabaseAdmin.from("match_history").select("*").eq("share_hash", h).maybeSingle();
  }

  const { data, error } = res;

  if (error) {
    console.error("loadMatchHistoryByShareHash:", error.message);
    return { row: null, error: "db_error" };
  }
  if (!data) {
    return { row: null, error: "not_found" };
  }

  const raw = data as MatchHistoryDbRow;
  const lobby_room_code = lobbyCodeFromRoomsJoin(raw.rooms);
  const { rooms: _r, ...rest } = raw;
  const row: MatchHistoryRecord = {
    ...(rest as MatchHistoryRecord),
    lobby_room_code,
  };

  return { row, error: null };
}
