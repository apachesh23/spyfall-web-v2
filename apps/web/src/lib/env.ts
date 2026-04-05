export function getPublicColyseusUrl(): string {
  const url = process.env.NEXT_PUBLIC_COLYSEUS_URL;
  if (!url) {
    return "http://localhost:2567";
  }
  return url.replace(/\/$/, "");
}
