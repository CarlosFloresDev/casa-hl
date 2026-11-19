/**
 * Limitador de ventana fija en memoria. Suficiente para una sola instancia;
 * con varias instancias conviene moverlo a un almacenamiento compartido (Redis, KV).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
