import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { SESSION_ID } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_KEY;
  const provided = req.nextUrl.searchParams.get("key");
  if (!expected || provided !== expected) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const sessionId =
    typeof body.session_id === "string" && body.session_id.length > 0
      ? body.session_id
      : SESSION_ID;

  const db = getDb();
  db.prepare("DELETE FROM participants WHERE session_id = ?").run(sessionId);
  return NextResponse.json({ ok: true });
}
