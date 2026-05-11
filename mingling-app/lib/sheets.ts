export type ParticipantRow = {
  id: string;
  session_id: string;
  name: string;
  original_team: number;
  created_at: string;
  updated_at: string;
};

function getApiUrl(): string {
  const url = process.env.GOOGLE_SHEET_API_URL;
  if (!url) {
    throw new Error(
      "GOOGLE_SHEET_API_URL이 설정되지 않았어요. .env.local 또는 배포 환경변수에 등록하세요."
    );
  }
  return url;
}

export async function listParticipants(
  sessionId: string
): Promise<ParticipantRow[]> {
  const url = `${getApiUrl()}?session_id=${encodeURIComponent(sessionId)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheets API ${res.status}`);
  const data = (await res.json()) as {
    participants?: ParticipantRow[];
    error?: string;
  };
  if (data.error) throw new Error(data.error);
  return data.participants ?? [];
}

export async function submitParticipant(input: {
  session_id: string;
  name: string;
  original_team: number;
}): Promise<void> {
  const res = await postAction({
    action: "submit",
    session_id: input.session_id,
    name: input.name,
    original_team: input.original_team,
  });
  if (res.error) throw new Error(res.error);
}

export async function clearSession(input: {
  session_id: string;
  admin_key: string;
}): Promise<{ deleted: number }> {
  const res = await postAction({
    action: "clear",
    session_id: input.session_id,
    key: input.admin_key,
  });
  if (res.error) throw new Error(res.error);
  return { deleted: typeof res.deleted === "number" ? res.deleted : 0 };
}

type ActionBody = Record<string, unknown> & { action: string };
type ActionResponse = {
  ok?: boolean;
  error?: string;
  deleted?: number;
};

async function postAction(body: ActionBody): Promise<ActionResponse> {
  const res = await fetch(getApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}`);
  return (await res.json()) as ActionResponse;
}
