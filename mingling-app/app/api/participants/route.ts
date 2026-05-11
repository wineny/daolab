import { NextRequest, NextResponse } from "next/server";
import { getDb, type ParticipantRow } from "@/lib/db";
import { SESSION_ID } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id") || SESSION_ID;
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, session_id, name, original_team, created_at, updated_at
       FROM participants
       WHERE session_id = ?
       ORDER BY created_at ASC`
    )
    .all(sessionId) as ParticipantRow[];
  return NextResponse.json({ participants: rows });
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

  const db = getDb();
  db.prepare(
    `INSERT INTO participants (session_id, name, original_team)
     VALUES (?, ?, ?)
     ON CONFLICT(session_id, name) DO UPDATE
       SET original_team = excluded.original_team,
           updated_at = datetime('now')`
  ).run(sessionId, name, team);

  return NextResponse.json({ ok: true });
}
