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
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return extra ? `${extra}:${ip}` : ip;
}
