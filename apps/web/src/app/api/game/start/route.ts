import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function POST(request: Request) {
  try {
    const { roomId, hostId } = await request.json();

    if (!roomId || !hostId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, host_id, status")
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

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("rooms")
      .update({
        status: "playing",
        game_started_at: now,
        updated_at: now,
      })
      .eq("id", roomId);

    if (updateError) {
      console.error("Game start update error:", updateError);
      return NextResponse.json({ error: "Не удалось начать игру" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Game start API error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
