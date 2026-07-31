import { NextRequest, NextResponse } from "next/server";
import { drainIce, pushIce, getRoom, type IceSide } from "@/lib/rooms";

export const runtime = "nodejs";

const isSide = (s: unknown): s is IceSide => s === "server" || s === "client";

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("roomId");
  const side = req.nextUrl.searchParams.get("side");

  if (!roomId || !isSide(side)) {
    return NextResponse.json(
      { ok: false, error: "roomId & side wajib" },
      { status: 400 }
    );
  }

  if (!(await getRoom(roomId))) {
    return NextResponse.json({ ok: false, error: "Ruangan tidak ditemukan" }, { status: 404 });
  }

  const candidates = await drainIce(roomId, side);
  return NextResponse.json({ ok: true, candidates });
}

export async function POST(req: NextRequest) {
  let body: { roomId?: string; side?: string; candidate?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const { roomId, side, candidate } = body;
  if (!roomId || !isSide(side) || candidate == null) {
    return NextResponse.json(
      { ok: false, error: "roomId, side & candidate wajib" },
      { status: 400 }
    );
  }

  if (!(await getRoom(roomId))) {
    return NextResponse.json({ ok: false, error: "Ruangan tidak ditemukan" }, { status: 404 });
  }

  await pushIce(roomId, side, candidate);
  return NextResponse.json({ ok: true });
}
