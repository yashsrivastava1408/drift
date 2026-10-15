const hits = new Map<string, number[]>();

/** Simple in-memory limiter: at most `limit` calls per `windowMs` for each key. */
export function rateLimit(key: string, limit = 12, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}
