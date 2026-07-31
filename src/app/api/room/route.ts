import { NextRequest, NextResponse } from "next/server";
import { getRoom, patchRoom, setConnected, type IceSide } from "@/lib/rooms";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("roomId");
  if (!roomId) {
    return NextResponse.json({ ok: false, error: "roomId wajib" }, { status: 400 });
  }
  const room = await getRoom(roomId);
  if (!room) {
    return NextResponse.json({ ok: false, error: "Ruangan tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json(room);
}

export async function POST(req: NextRequest) {
  let body: {
    roomId?: string;
    offer?: string;
    answer?: string;
    connected?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const roomId = body.roomId;
  if (!roomId) {
    return NextResponse.json({ ok: false, error: "roomId wajib" }, { status: 400 });
  }

  if (!(await getRoom(roomId))) {
    return NextResponse.json({ ok: false, error: "Ruangan tidak ditemukan" }, { status: 404 });
  }

  if (body.connected === "server" || body.connected === "client") {
    await setConnected(roomId, body.connected as IceSide);
  } else {
    await patchRoom(roomId, {
      ...(body.offer ? { offer: body.offer } : {}),
      ...(body.answer ? { answer: body.answer } : {}),
    });
  }

  return NextResponse.json({ ok: true });
}
