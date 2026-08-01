import { NextRequest, NextResponse } from "next/server";
import { closeRoom } from "@/lib/rooms";

export const runtime = "nodejs";

/** Dipanggil saat server keluar aplikasi → hapus room + OTP + ICE. */
export async function POST(req: NextRequest) {
  let roomId = "";
  try {
    const body = await req.json();
    roomId = String(body.roomId ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  if (!roomId) {
    return NextResponse.json({ ok: false, error: "roomId wajib" }, { status: 400 });
  }

  await closeRoom(roomId);
  return NextResponse.json({ ok: true });
}
