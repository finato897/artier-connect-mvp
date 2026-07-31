import { Redis } from "@upstash/redis";

// Upstash Redis (Vercel KV) sebagai signaling store.
// Env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
// Tanpa konfigurasi (dev lokal), pakai in-memory fallback agar tetap jalan.

const isConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

/** Minimal command interface yang dipakai lib/rooms. */
export interface StoreLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ex?: number }): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  rpush(key: string, ...values: string[]): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
}

export const store: StoreLike = isConfigured ? Redis.fromEnv() : createMemoryStore();

export function hasRedis(): boolean {
  return isConfigured;
}

// --- In-memory fallback (dev lokal tanpa KV) ---
type Entry = { value: string; expiresAt: number };
type MemoryKV = Map<string, Entry>;

function createMemoryStore(): StoreLike {
  const kv: MemoryKV = new Map();

  const get = (k: string): Entry | null => {
    const e = kv.get(k);
    if (!e) return null;
    if (e.expiresAt !== 0 && Date.now() > e.expiresAt) {
      kv.delete(k);
      return null;
    }
    return e;
  };

  const readArr = (k: string): string[] => {
    const e = get(k);
    return e ? JSON.parse(e.value) : [];
  };

  return {
    async get(key) {
      return get(key)?.value ?? null;
    },
    async set(key, value, opts) {
      kv.set(key, { value, expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : 0 });
    },
    async del(...keys) {
      keys.forEach((k) => kv.delete(k));
    },
    async rpush(key, ...values) {
      const e = get(key);
      kv.set(key, {
        value: JSON.stringify([...(e ? JSON.parse(e.value) : []), ...values]),
        expiresAt: e?.expiresAt ?? 0,
      });
    },
    async lrange(key, start, stop) {
      const arr = readArr(key);
      return arr.slice(start, stop === -1 ? undefined : stop + 1);
    },
    async ltrim(key, start, stop) {
      const e = get(key);
      if (!e) return;
      kv.set(key, {
        value: JSON.stringify(
          (JSON.parse(e.value) as string[]).slice(
            start,
            stop === -1 ? undefined : stop + 1
          )
        ),
        expiresAt: e.expiresAt,
      });
    },
  };
}
