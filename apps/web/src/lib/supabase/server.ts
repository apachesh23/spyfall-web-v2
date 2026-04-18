import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ??
  ""
).trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    [
      "Supabase (service role): задайте NEXT_PUBLIC_SUPABASE_URL (или SUPABASE_URL) и SUPABASE_SERVICE_ROLE_KEY.",
      "Ключ service role — только в серверных env (Vercel), никогда не NEXT_PUBLIC_.",
      "Берётся в Supabase → Project Settings → API → service_role.",
      `Сейчас: url=${Boolean(supabaseUrl)} serviceRole=${Boolean(supabaseServiceKey)}`,
    ].join(" "),
  );
}

// Этот клиент используй ТОЛЬКО в API Routes!
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});