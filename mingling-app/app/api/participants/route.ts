import { NextRequest, NextResponse } from "next/server";
import { listParticipants, submitParticipant } from "@/lib/sheets";
import { SESSION_ID } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id") || SESSION_ID;
  try {
    const participants = await listParticipants(sessionId);
    return NextResponse.json({ participants });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "조회 실패";
    return NextResponse.json({ error: msg, participants: [] }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  let body: { name?: unknown; original_team?: unknown; session_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const team = Number(body.original_team);
  const sessionId =
    typeof body.session_id === "string" && body.session_id.length > 0
      ? body.session_id
      : SESSION_ID;

  if (name.length < 1 || name.length > 20) {
    return NextResponse.json({ error: "이름은 1~20자" }, { status: 400 });
  }
  if (!Number.isInteger(team) || team < 1 || team > 6) {
    return NextResponse.json({ error: "조는 1~6" }, { status: 400 });
  }

  try {
    await submitParticipant({ session_id: sessionId, name, original_team: team });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "제출 실패";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
