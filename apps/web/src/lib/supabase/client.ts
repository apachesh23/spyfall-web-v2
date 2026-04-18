import { createClient } from "@supabase/supabase-js";

/**
 * В Vercel для клиентского бандла обязательны `NEXT_PUBLIC_*`.
 * `SUPABASE_ANON_KEY` (без префикса) подхватится только на сервере (API routes / SSR);
 * для браузера добавьте `NEXT_PUBLIC_SUPABASE_ANON_KEY` с тем же значением, что anon key в Supabase.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ??
  ""
).trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    [
      "Supabase (browser/server): задайте NEXT_PUBLIC_SUPABASE_URL и ключ anon.",
      "Нужно: NEXT_PUBLIC_SUPABASE_ANON_KEY (рекомендуется; как в Supabase → Project Settings → API → anon public).",
      "Допустимо дублировать то же значение в SUPABASE_ANON_KEY — только для серверного кода.",
      `Сейчас: url=${Boolean(supabaseUrl)} anonKey=${Boolean(supabaseAnonKey)}`,
    ].join(" "),
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);