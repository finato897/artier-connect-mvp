import { NextRequest, NextResponse } from "next/server";
import { createRoom, generateCode } from "@/lib/rooms";
import { hasRedis } from "@/lib/redis";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let publicIp: string | undefined;
  try {
    const body = await req.json();
    if (typeof body.publicIp === "string") publicIp = body.publicIp;
  } catch {
    // body kosong → lanjut tanpa publicIp
  }

  const code = generateCode();
  const roomId = await createRoom(code, publicIp);

  return NextResponse.json({
    ok: true,
    code,
    roomId,
    redis: hasRedis() ? "yes" : "no",
  });
}
