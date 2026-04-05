export function getPublicColyseusUrl(): string {
  const url = process.env.NEXT_PUBLIC_COLYSEUS_URL;
  if (!url) {
    return "http://localhost:2567";
  }
  return url.replace(/\/$/, "");
}

/** База URL Colyseus для вызовов matchmake из API routes (create). См. COLYSEUS_URL в .env для Docker/прода. */
export function getColyseusServerBaseUrl(): string {
  const url =
    process.env.COLYSEUS_URL ?? process.env.NEXT_PUBLIC_COLYSEUS_URL ?? "http://127.0.0.1:2567";
  return url.replace(/\/$/, "");
}
