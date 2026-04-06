const LOCATION_FALLBACK = "/avatars/agent_01.webp";

/** 1×1 прозрачный GIF — последний кандидат, чтобы onError не зацикливался. */
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Публичный путь картинки локации по `locations.image_key` из БД. */
export function locationImageSrc(imageKey: string): string {
  const k = imageKey.trim();
  if (!k || k === "default") return "";
  if (k.startsWith("/") || k.startsWith("http://") || k.startsWith("https://")) return k;
  const lower = k.toLowerCase();
  if (
    lower.endsWith(".webp") ||
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg")
  ) {
    return `/locations/${k}`;
  }
  return `/locations/${k}.webp`;
}

export function locationImageFallbackSrc(): string {
  return LOCATION_FALLBACK;
}

/**
 * Цепочка URL для <img>: один запрос под ключ из БД, затем общий fallback как у аватаров (без 4× 404 на png/jpg).
 */
export function locationImageCandidates(imageKey: string): string[] {
  const k = imageKey.trim();
  const fb = locationImageFallbackSrc();
  const tail = [fb, "/locations/spy1.webp", TRANSPARENT_PIXEL];
  if (!k || k === "default") return [...new Set(tail)];
  if (k.startsWith("http://") || k.startsWith("https://")) return [...new Set([k, ...tail])];
  if (k.startsWith("/")) return [...new Set([k, ...tail])];
  const hasExt = /\.(webp|png|jpe?g)$/i.test(k);
  const primary = hasExt ? `/locations/${k}` : `/locations/${k}.webp`;
  return [...new Set([primary, ...tail])];
}

/**
 * Нормализует themes/roles из Postgres (массив, json, строка вида {a,b}).
 */
export function parsePgTextArray(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    if (keys.length > 0) {
      const fromObj = keys
        .map((k) => o[k])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      if (fromObj.length > 0) return fromObj;
    }
  }
  if (Array.isArray(value)) {
    const strings = value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    if (strings.length > 0) return strings;
    const nested = value.flatMap((x) => (typeof x === "string" ? parsePgTextArray(x) : []));
    return nested.length > 0 ? nested : [];
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return [];
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        const j = JSON.parse(s) as unknown;
        if (typeof j === "string") return parsePgTextArray(j);
        if (Array.isArray(j)) {
          return j.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        }
      } catch {
        /* fall through */
      }
    }
    if (s.startsWith("{") && s.endsWith("}")) {
      const inner = s.slice(1, -1);
      if (!inner) return [];
      return inner.split(",").map((x) => x.replace(/^"|"$/g, "").trim()).filter(Boolean);
    }
    return [s];
  }
  return [];
}
