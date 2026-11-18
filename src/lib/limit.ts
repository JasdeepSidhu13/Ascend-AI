type Bucket = { n: number; start: number };

const buckets = new Map<string, Bucket>();

export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now - cur.start > windowMs) {
    buckets.set(key, { n: 1, start: now });
    return false;
  }
  cur.n += 1;
  return cur.n > max;
}

export function clientKey(request: Request, extra = ""): string {
  const real = request.headers.get("x-real-ip")?.trim();
  const hops = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ip = real || hops.at(-1) || "local";
  return extra ? `${extra}:${ip}` : ip;
}
