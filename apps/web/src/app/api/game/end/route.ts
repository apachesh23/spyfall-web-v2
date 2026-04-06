import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

/** Ведущий завершает матч: все клиенты на /play/* получают realtime и уходят в лобби. */
export async function POST(request: Request) {
  try {
    const { roomId, hostId } = await request.json();

    if (!roomId || !hostId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, host_id, status, settings")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    }

    if (room.host_id !== hostId) {
      return NextResponse.json({ error: "Только ведущий может завершить матч" }, { status: 403 });
    }

    if (room.status !== "playing") {
      return NextResponse.json({ error: "Матч уже не идёт" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updatePayload: {
      status: string;
      updated_at: string;
      splash_event: null;
      settings?: Record<string, unknown>;
    } = {
      status: "waiting",
      updated_at: now,
      splash_event: null,
    };
    if (room.settings && typeof room.settings === "object" && !Array.isArray(room.settings)) {
      const next = { ...(room.settings as Record<string, unknown>) };
      delete next.colyseus_room_id;
      delete next.match_display_theme;
      delete next.match_display_roles;
      delete next.match_theme_snapshot;
      delete next.match_debug;
      updatePayload.settings = next;
    }

    const { error: updateError } = await supabase.from("rooms").update(updatePayload).eq("id", roomId);

    if (updateError) {
      console.error("Game end update error:", updateError);
      return NextResponse.json({ error: "Не удалось завершить матч" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Game end API error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
