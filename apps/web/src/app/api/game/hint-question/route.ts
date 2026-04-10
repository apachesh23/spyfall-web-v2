import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/game/hint-question
 * Случайный вопрос из словаря; при gameId — без повторов внутри партии (room id в Supabase).
 */
export async function POST(req: Request) {
  try {
    const { gameId } = await req.json();
    if (!gameId || typeof gameId !== "string") {
      return NextResponse.json({ category_key: null, text: null }, { status: 200 });
    }

    const { data, error } = await supabaseAdmin.rpc("get_random_hint_question_for_game", {
      p_game_id: gameId,
    });

    if (error) {
      console.error("get_random_hint_question_for_game error:", error);
      return NextResponse.json({ error: "Failed to fetch hint question" }, { status: 500 });
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : data;
    const text =
      typeof row?.question_text === "string"
        ? row.question_text
        : typeof row?.text === "string"
          ? row.text
          : null;
    const category_key = row?.category_key ?? null;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ category_key, text: null }, { status: 200 });
    }

    return NextResponse.json({ category_key, text });
  } catch (e) {
    console.error("hint-question API error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** GET: глобальный случайный вопрос (без учёта партии). */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.rpc("get_random_hint_question");
    if (error) {
      console.error("get_random_hint_question error:", error);
      return NextResponse.json({ error: "Failed to fetch hint question" }, { status: 500 });
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : data;
    const text = row?.text;
    const category_key = row?.category_key ?? null;
    return NextResponse.json({
      category_key: typeof category_key === "string" ? category_key : null,
      text: typeof text === "string" ? text : null,
    });
  } catch (e) {
    console.error("hint-question API error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
