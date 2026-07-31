import { store } from "./redis";

// Keys Redis: prefix `ac:`.
// - ac:otp:<code>  → roomId          (TTL 180s)
// - ac:room:<roomId> → JSON RoomState (TTL 15m)
// - ac:ice:server:<roomId> / ac:ice:client:<roomId> → list kandidat ICE

export const OTP_TTL_SEC = 180;
export const ROOM_TTL_SEC = 60 * 15;
const PREFIX = "ac";

const otpKey = (code: string) => `${PREFIX}:otp:${code}`;
const roomKey = (roomId: string) => `${PREFIX}:room:${roomId}`;
const iceKey = (roomId: string, side: IceSide) => `${PREFIX}:ice:${side}:${roomId}`;

export type IceSide = "server" | "client";

export interface RoomState {
  /** roomId itu sendiri */
  roomId: string;
  code: string;
  /** IP publik device server (untuk same-WiFi check) */
  serverIp?: string;
  clientIp?: string;
  joined: boolean;
  /** true jika client join yang lolos validasi */
  state: "waiting" | "paired" | "connected" | "closed";
  offer?: string;
  answer?: string;
  serverConnected?: boolean;
  clientConnected?: boolean;
}

/** Acak 6 digit angka (bukan crypto untuk kode pairing). */
export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function generateRoomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createRoom(
  code: string,
  serverIp?: string
): Promise<string> {
  const roomId = generateRoomId();
  const room: RoomState = { roomId, code, serverIp, joined: false, state: "waiting" };
  await store.set(roomKey(roomId), JSON.stringify(room), { ex: ROOM_TTL_SEC });
  await store.set(otpKey(code), roomId, { ex: OTP_TTL_SEC });
  return roomId;
}

export async function resolveCode(code: string): Promise<string | null> {
  return store.get(otpKey(code));
}

export async function getRoom(roomId: string): Promise<RoomState | null> {
  const raw = await store.get(roomKey(roomId));
  return raw ? (JSON.parse(raw) as RoomState) : null;
}

async function setRoom(room: RoomState): Promise<void> {
  await store.set(roomKey(room.roomId), JSON.stringify(room), {
    ex: ROOM_TTL_SEC,
  });
}

export async function patchRoom(
  roomId: string,
  patch: Partial<RoomState>
): Promise<RoomState | null> {
  const room = await getRoom(roomId);
  if (!room) return null;
  Object.assign(room, patch);
  await setRoom(room);
  return room;
}

export async function closeRoom(roomId: string): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) return;
  room.state = "closed";
  await setRoom(room);
  await store.del(otpKey(room.code));
}

// --- ICE trickle, drain-on-read (LRANGE + LTRIM) ---
export async function pushIce(
  roomId: string,
  side: IceSide,
  candidate: unknown
): Promise<void> {
  await store.rpush(iceKey(roomId, side), JSON.stringify(candidate));
}

export async function drainIce(
  roomId: string,
  side: IceSide
): Promise<unknown[]> {
  const key = iceKey(roomId, side);
  const raw = await store.lrange(key, 0, -1);
  if (raw.length) await store.ltrim(key, raw.length, -1);
  return raw.map((s) => JSON.parse(s));
}

export async function setConnected(
  roomId: string,
  side: IceSide
): Promise<void> {
  await patchRoom(roomId, {
    state: "connected",
    ...(side === "server"
      ? { serverConnected: true }
      : { clientConnected: true }),
  });
}
