import { NextResponse } from "next/server";
import { COLYSEUS_ROOM_NAME } from "@spyfall/shared";
import { getColyseusServerBaseUrl } from "@/lib/env";
import { supabase } from "@/lib/supabase/client";

type MatchmakeCreateResponse = {
  room?: { roomId?: string };
  sessionId?: string;
  error?: string;
  code?: number;
};

export async function POST(request: Request) {
  try {
    const { roomId, hostId } = await request.json();

    if (!roomId || !hostId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const { data: room, error: roomError } = await supabase
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

    const gameDurationMin =
      typeof rawSettings.game_duration === "number" ? rawSettings.game_duration : 15;
    const discussionDurationMs = Math.max(
      30_000,
      Math.min(3_600_000, Math.floor(gameDurationMin * 60 * 1000)),
    );

    const colyseusBase = getColyseusServerBaseUrl();
    const mmUrl = `${colyseusBase}/matchmake/create/${COLYSEUS_ROOM_NAME}`;
    const mmRes = await fetch(mmUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchSessionId: String(room.code).trim(),
        discussionDurationMs,
      }),
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
    const nextSettings = { ...rawSettings, colyseus_room_id: colyseusRoomId };

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
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
