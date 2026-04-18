import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type MatchHistoryInsert = {
  share_hash: string;
  room_id: string | null;
  started_at: string;
  ended_at: string;
  winner: "civilians" | "spies";
  game_end_reason: string;
  location_name: string;
  theme_text: string;
  mode_theme: boolean;
  mode_role: boolean;
  mode_hidden_threat: boolean;
  discussion_duration_ms: number;
  discussion_elapsed_ms: number;
  payload: {
    players: unknown[];
    events: unknown[];
  };
};

let cachedClient: SupabaseClient | null = null;
let warnedMissingEnv = false;

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (!warnedMissingEnv) {
      warnedMissingEnv = true;
      console.warn(
        "[match_history] Supabase URL/key missing at persist time — check loadGameServerEnv() and apps/web/.env.local.",
      );
    }
    return null;
  }
  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cachedClient;
}

export async function persistMatchHistory(row: MatchHistoryInsert): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase.from("match_history").insert({
    share_hash: row.share_hash,
    room_id: row.room_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    winner: row.winner,
    game_end_reason: row.game_end_reason,
    location_name: row.location_name,
    theme_text: row.theme_text,
    mode_theme: row.mode_theme,
    mode_role: row.mode_role,
    mode_hidden_threat: row.mode_hidden_threat,
    discussion_duration_ms: row.discussion_duration_ms,
    discussion_elapsed_ms: row.discussion_elapsed_ms,
    payload: row.payload,
  });

  if (error) {
    console.error("[match_history] insert failed:", error.message);
    return false;
  }
  console.log(`[match_history] saved share_hash=${row.share_hash}`);
  return true;
}
