import { NextResponse } from "next/server";
import { COLYSEUS_ROOM_NAME } from "@spyfall/shared";
import {
  buildMatchRoomOptions,
  type DbLocationRow,
  type DbPlayerRow,
} from "@/lib/gameStart/buildMatchRoomOptions";
import { getColyseusServerBaseUrl } from "@/lib/env";
import { parsePgTextArray } from "@/lib/locations";
import { normalizeRoomSettings } from "@/lib/normalizeRoomSettings";
import { supabaseAdmin } from "@/lib/supabase/server";

type MatchmakeCreateResponse = {
  room?: { roomId?: string };
  sessionId?: string;
  error?: string;
  code?: number;
};

export async function POST(request: Request) {
  try {
    const { roomId, hostId, matchDebug } = (await request.json()) as {
      roomId?: string;
      hostId?: string;
      matchDebug?: boolean;
    };

    if (!roomId || !hostId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const { data: room, error: roomError } = await supabaseAdmin
      .from("rooms")
      .select("id, host_id, status, settings, code")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    }

    if (room.host_id !== hostId) {
      return NextResponse.json({ error: "Только ведущий может начать игру" }, { status: 403 });
    }

    if (room.status !== "waiting") {
      return NextResponse.json({ error: "Игра уже идёт" }, { status: 400 });
    }

    const rawSettings =
      room.settings && typeof room.settings === "object" && !Array.isArray(room.settings)
        ? ({ ...(room.settings as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    const settings = normalizeRoomSettings(rawSettings);

    const gameDurationMin = settings.game_duration;
    const discussionDurationMs = Math.max(
      30_000,
      Math.min(3_600_000, Math.floor(gameDurationMin * 60 * 1000)),
    );

    const { data: playerRows, error: playersError } = await supabaseAdmin
      .from("players")
      .select("id, nickname, avatar_id, is_host")
      .eq("room_id", roomId);

    if (playersError) {
      console.error("Game start players fetch:", playersError);
      return NextResponse.json({ error: "Не удалось загрузить игроков" }, { status: 500 });
    }

    const players = (playerRows ?? []) as DbPlayerRow[];
    if (players.length < 3) {
      return NextResponse.json({ error: "Минимум 3 игрока для старта" }, { status: 400 });
    }

    const { data: locRows, error: locError } = await supabaseAdmin
      .from("locations")
      .select("id, name, themes, roles, image_key");

    if (locError) {
      console.error("Game start locations fetch:", locError);
      return NextResponse.json({ error: "Не удалось загрузить локации" }, { status: 500 });
    }

    const locations = (locRows ?? []) as DbLocationRow[];
    if (locations.length === 0) {
      return NextResponse.json(
        { error: "В базе нет локаций — добавь записи в таблицу locations" },
        { status: 400 },
      );
    }

    const rawLoc = locations[Math.floor(Math.random() * locations.length)]!;
    const location: DbLocationRow = {
      id: rawLoc.id,
      name: rawLoc.name,
      themes: parsePgTextArray(rawLoc.themes),
      roles: parsePgTextArray(rawLoc.roles),
      image_key: rawLoc.image_key,
    };

    let matchPayload: ReturnType<typeof buildMatchRoomOptions>;
    try {
      matchPayload = buildMatchRoomOptions(
        String(room.code).trim(),
        discussionDurationMs,
        players,
        location,
        settings,
      );
    } catch (e) {
      console.error("buildMatchRoomOptions:", e);
      return NextResponse.json({ error: "Не удалось сформировать матч" }, { status: 500 });
    }

    const colyseusBase = getColyseusServerBaseUrl();
    const mmUrl = `${colyseusBase}/matchmake/create/${COLYSEUS_ROOM_NAME}`;
    const mmRes = await fetch(mmUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matchPayload),
    });

    const mmJson = (await mmRes.json().catch(() => ({}))) as MatchmakeCreateResponse;
    if (!mmRes.ok || mmJson.error || !mmJson.room?.roomId) {
      console.error("Colyseus matchmake/create failed:", mmRes.status, mmJson);
      return NextResponse.json(
        {
          error:
            mmJson.error ??
            "Не удалось создать игровую комнату (запущен ли game-server на COLYSEUS_URL / порту Colyseus?)",
        },
        { status: 502 },
      );
    }

    const colyseusRoomId = mmJson.room.roomId;
    const nextSettings: Record<string, unknown> = {
      ...rawSettings,
      colyseus_room_id: colyseusRoomId,
      match_display_theme: settings.mode_theme,
      match_display_roles: settings.mode_roles,
      match_theme_snapshot: settings.mode_theme ? matchPayload.themeText : undefined,
    };
    if (matchDebug === true) {
      nextSettings.match_debug = true;
    } else {
      delete nextSettings.match_debug;
    }

    const now = new Date().toISOString();
    /** Только колонки из реальной схемы `rooms` (см. docs/current-db/schema-rooms.json). */
    const { error: updateError } = await supabaseAdmin
      .from("rooms")
      .update({
        status: "playing",
        updated_at: now,
        settings: nextSettings,
      })
      .eq("id", roomId);

    if (updateError) {
      console.error("Game start update error:", updateError);
      return NextResponse.json({ error: "Не удалось начать игру" }, { status: 500 });
    }

    return NextResponse.json({ success: true, colyseusRoomId });
  } catch (e) {
    console.error("Game start API error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
