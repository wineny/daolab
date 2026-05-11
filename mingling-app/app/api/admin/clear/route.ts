import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/sheets";
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

  try {
    const result = await clearSession({
      session_id: sessionId,
      admin_key: expected,
    });
    return NextResponse.json({ ok: true, deleted: result.deleted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "삭제 실패";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
