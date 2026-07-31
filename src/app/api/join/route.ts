import { NextRequest, NextResponse } from "next/server";
import { getRoom, patchRoom, resolveCode } from "@/lib/rooms";

export const runtime = "nodejs";

const CODE_RE = /^\d{6}$/;

export async function POST(req: NextRequest) {
  let code = "";
  let clientIp: string | undefined;
  try {
    const body = await req.json();
    code = String(body.code ?? "").trim();
    if (typeof body.publicIp === "string") clientIp = body.publicIp;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  if (!CODE_RE.test(code)) {
    return NextResponse.json(
      { ok: false, error: "Kode harus 6 digit angka" },
      { status: 400 }
    );
  }

  const roomId = await resolveCode(code);
  if (!roomId) {
    return NextResponse.json(
      { ok: false, error: "Kode tidak ditemukan atau sudah kedaluwarsa" },
      { status: 404 }
    );
  }

  const room = await getRoom(roomId);
  if (!room) {
    return NextResponse.json(
      { ok: false, error: "Ruangan tidak ditemukan" },
      { status: 404 }
    );
  }

  if (room.joined) {
    return NextResponse.json(
      { ok: false, error: "Kode sudah dipakai perangkat lain" },
      { status: 409 }
    );
  }

  // Same-WiFi check: banding public IP server vs client.
  if (room.serverIp && clientIp && room.serverIp !== clientIp) {
    return NextResponse.json(
      {
        ok: false,
        wifiMismatch: true,
        error: "Kedua perangkat harus terhubung ke WiFi yang sama",
      },
      { status: 403 }
    );
  }

  await patchRoom(roomId, { joined: true, clientIp, state: "paired" });

  return NextResponse.json({ ok: true, roomId });
}
