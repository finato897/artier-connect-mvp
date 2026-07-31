import type { RoomState, IceSide } from "./rooms";

// Protocol API signaling. Semua request/response JSON via HTTP polling.

export interface CreateResponse {
  ok: boolean;
  roomId?: string;
  code?: string;
  error?: string;
  /** true jika di jaringan berbeda (serverIp != clientIp) — client ditolak */
  wifiMismatch?: boolean;
  warning?: string;
}

export type JoinResponse = CreateResponse;

export async function apiCreate(publicIp?: string): Promise<CreateResponse> {
  const res = await fetch("/api/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicIp }),
  });
  return res.json();
}

export async function apiJoin(code: string, publicIp?: string): Promise<JoinResponse> {
  const res = await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, publicIp }),
  });
  return res.json();
}

/** Ambil state room saat ini (polling). */
export async function apiGetRoom(roomId: string): Promise<RoomState | null> {
  const res = await fetch(`/api/room?roomId=${encodeURIComponent(roomId)}`);
  if (!res.ok) return null;
  return res.json();
}

/** Tulis offer/answer ke room. */
export async function apiPutRoom(
  roomId: string,
  patch: { offer?: string; answer?: string }
): Promise<boolean> {
  const res = await fetch("/api/room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, ...patch }),
  });
  return res.ok;
}

export async function apiPushIce(roomId: string, side: IceSide, candidate: unknown) {
  await fetch("/api/ice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, side, candidate }),
  });
}

export async function apiDrainIce(roomId: string, side: IceSide): Promise<unknown[]> {
  const res = await fetch(
    `/api/ice?roomId=${encodeURIComponent(roomId)}&side=${side}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.candidates ?? [];
}

export async function apiConnected(roomId: string, side: IceSide) {
  await fetch("/api/room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, connected: side }),
  });
}

/** Ambil public IP untuk same-WiFi check. Gagal → null (soft-pass). */
export async function getPublicIp(): Promise<string | null> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.ip === "string" ? data.ip : null;
  } catch {
    return null;
  }
}

/** Polling helper dengan backoff dan sinyal stop. */
export function pollWhile(
  ms: number,
  stop: () => boolean
): { stopPolling: () => void; wait: Promise<void> } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let done = false;
  const stopPolling = () => {
    done = true;
    if (timer) clearTimeout(timer);
  };
  const wait = new Promise<void>((resolve) => {
    const tick = () => {
      if (done || stop()) {
        resolve();
        return;
      }
      timer = setTimeout(tick, ms);
    };
    tick();
  });
  return { stopPolling, wait };
}
