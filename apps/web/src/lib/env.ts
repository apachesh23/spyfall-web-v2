export function getPublicColyseusUrl(): string {
  const url = process.env.NEXT_PUBLIC_COLYSEUS_URL;
  if (!url) {
    return "http://localhost:2567";
  }
  return url.replace(/\/$/, "");
}

/**
 * Страница с `http://192.168.x.x:3000`, а Colyseus в env — `http://localhost:2567` → в браузере WebSocket идёт на
 * localhost **устройства** (телефон), а не на ПК. Подменяем host на host страницы, если цель — loopback, а страница — нет.
 * Game-server должен слушать `0.0.0.0` (у Node `listen(port)` по умолчанию так и есть).
 */
export function resolveColyseusUrlForBrowser(colyseusUrl: string): string {
  const trimmed = colyseusUrl.replace(/\/$/, "");
  if (typeof window === "undefined") return trimmed;
  try {
    const u = new URL(trimmed);
    const targetLoopback = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    const pageHost = window.location.hostname;
    const pageLoopback = pageHost === "localhost" || pageHost === "127.0.0.1";
    if (targetLoopback && !pageLoopback) {
      u.hostname = pageHost;
      return u.toString().replace(/\/$/, "");
    }
  } catch {
    /* ignore */
  }
  return trimmed;
}

/** База URL Colyseus для вызовов matchmake из API routes (create). См. COLYSEUS_URL в .env для Docker/прода. */
export function getColyseusServerBaseUrl(): string {
  const url =
    process.env.COLYSEUS_URL ?? process.env.NEXT_PUBLIC_COLYSEUS_URL ?? "http://127.0.0.1:2567";
  return url.replace(/\/$/, "");
}
