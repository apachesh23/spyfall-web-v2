import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Ведущий ставит матч на паузу: фиксируем оставшееся время в `rooms.settings` (для UI и будущих таймеров). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      roomId?: string;
      hostId?: string;
      remainingSec?: number;
    };
    const { roomId, hostId, remainingSec } = body;

    if (!roomId || !hostId) {
      return NextResponse.json({ error: "Missing roomId or hostId" }, { status: 400 });
    }
    if (typeof remainingSec !== "number" || !Number.isFinite(remainingSec) || remainingSec < 0) {
      return NextResponse.json({ error: "Invalid remainingSec" }, { status: 400 });
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
      return NextResponse.json({ error: "Только ведущий может ставить паузу" }, { status: 403 });
    }
    if (room.status !== "playing") {
      return NextResponse.json({ error: "Матч уже не идёт" }, { status: 400 });
    }

    const prev =
      room.settings && typeof room.settings === "object" && !Array.isArray(room.settings)
        ? (room.settings as Record<string, unknown>)
        : {};
    const nextSettings: Record<string, unknown> = {
      ...prev,
      match_paused: true,
      match_paused_remaining_sec: Math.floor(remainingSec),
    };

    const { error: updateError } = await supabaseAdmin
      .from("rooms")
      .update({
        settings: nextSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId);

    if (updateError) {
      console.error("Game pause update error:", updateError);
      return NextResponse.json({ error: "Не удалось поставить паузу" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Game pause API error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
