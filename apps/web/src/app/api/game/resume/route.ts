import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Ведущий снимает паузу: очищает флаги в `rooms.settings`. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { roomId?: string; hostId?: string };
    const { roomId, hostId } = body;

    if (!roomId || !hostId) {
      return NextResponse.json({ error: "Missing roomId or hostId" }, { status: 400 });
    }

    const { data: room, error: roomError } = await supabaseAdmin
      .from("rooms")
      .select("id, host_id, status, settings")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    }
    if (room.host_id !== hostId) {
      return NextResponse.json({ error: "Только ведущий может снять паузу" }, { status: 403 });
    }
    if (room.status !== "playing") {
      return NextResponse.json({ error: "Матч уже не идёт" }, { status: 400 });
    }

    const prev =
      room.settings && typeof room.settings === "object" && !Array.isArray(room.settings)
        ? (room.settings as Record<string, unknown>)
        : {};
    const nextSettings: Record<string, unknown> = { ...prev };
    delete nextSettings.match_paused;
    delete nextSettings.match_paused_remaining_sec;

    const { error: updateError } = await supabaseAdmin
      .from("rooms")
      .update({
        settings: nextSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId);

    if (updateError) {
      console.error("Game resume update error:", updateError);
      return NextResponse.json({ error: "Не удалось снять паузу" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Game resume API error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
