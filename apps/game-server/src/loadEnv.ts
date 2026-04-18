import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Подхватываем те же `.env`, что и Next (`apps/web/.env.local`), иначе game-server
 * не видит `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` при `npm run dev`.
 */
export function loadGameServerEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const gameServerRoot = resolve(here, "..");
  const appsRoot = resolve(gameServerRoot, "..");
  const repoRoot = resolve(appsRoot, "..");

  const paths = [
    resolve(repoRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(appsRoot, "web", ".env"),
    resolve(appsRoot, "web", ".env.local"),
    resolve(gameServerRoot, ".env"),
    resolve(gameServerRoot, ".env.local"),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      config({ path: p, override: true });
    }
  }

  const hasUrl = Boolean(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (hasUrl && hasKey) {
    console.log("[game-server] match_history: Supabase credentials found — inserts enabled.");
  } else {
    console.warn(
      "[game-server] match_history: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local — иначе история не пишется в БД.",
    );
  }
}
