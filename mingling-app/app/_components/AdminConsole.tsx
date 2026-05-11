"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { SESSION_ID } from "@/lib/session";
import {
  formGroups,
  type GroupingResult,
  type Participant,
} from "@/lib/grouping";

type Row = {
  id: number;
  name: string;
  original_team: number;
  created_at: string;
};

const TEAM_COLORS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-pink-500",
];

function teamColor(team: number): string {
  if (!Number.isFinite(team)) return "bg-zinc-600";
  const idx = (team - 1) % TEAM_COLORS.length;
  return TEAM_COLORS[idx >= 0 ? idx : 0];
}

const POLL_MS = 1500;

export function AdminConsole({ adminKey }: { adminKey: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<GroupingResult | null>(null);
  const [view, setView] = useState<"console" | "result">("console");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [participantUrl, setParticipantUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/`;
    setParticipantUrl(url);
    QRCode.toDataURL(url, {
      width: 480,
      margin: 1,
      color: { dark: "#ffffff", light: "#0b0b0f" },
    }).then(setQrDataUrl);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;

    async function load() {
      const myId = ++requestId;
      try {
        const res = await fetch(
          `/api/participants?session_id=${encodeURIComponent(SESSION_ID)}`,
          { cache: "no-store" }
        );
        if (cancelled || myId !== requestId) return;
        if (res.ok) {
          const data = await res.json();
          setRows((data.participants ?? []) as Row[]);
        }
      } catch {
      } finally {
        if (!cancelled && myId === requestId) setLoaded(true);
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const teamCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const r of rows)
      counts[r.original_team] = (counts[r.original_team] ?? 0) + 1;
    return counts;
  }, [rows]);

  const seedRef = useRef(0);
  function generate() {
    if (rows.length === 0) return;
    seedRef.current = Date.now();
    const ppl: Participant[] = rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      original_team: r.original_team,
    }));
    const r = formGroups(ppl, { trials: 300, seed: seedRef.current });
    setResult(r);
    setView("result");
  }

  function reroll() {
    if (rows.length === 0) return;
    seedRef.current = seedRef.current + 7919;
    const ppl: Participant[] = rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      original_team: r.original_team,
    }));
    const r = formGroups(ppl, { trials: 300, seed: seedRef.current });
    setResult(r);
  }

  async function clearAll() {
    if (!confirm("정말 모든 참가자 데이터를 삭제하시겠습니까?")) return;
    const res = await fetch(
      `/api/admin/clear?key=${encodeURIComponent(adminKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: SESSION_ID }),
      }
    );
    if (!res.ok) {
      alert("삭제 실패. 진행자 키를 확인하세요.");
      return;
    }
    setRows([]);
    setResult(null);
    setView("console");
  }

  if (view === "result" && result) {
    return (
      <ResultView
        result={result}
        onBack={() => setView("console")}
        onReroll={reroll}
      />
    );
  }

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[420px_1fr] gap-8">
        <section className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 flex flex-col items-center">
          <h2 className="text-zinc-400 text-sm uppercase tracking-widest mb-3">
            참가자 입장 QR
          </h2>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="참가자 QR"
              className="w-full max-w-xs aspect-square rounded-2xl"
            />
          ) : (
            <div className="w-full max-w-xs aspect-square bg-zinc-900 rounded-2xl animate-pulse" />
          )}
          <p className="mt-4 text-xs text-zinc-500 break-all text-center">
            {participantUrl || "..."}
          </p>
        </section>

        <section className="space-y-6">
          <header className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-zinc-500 text-sm uppercase tracking-widest">
                DaoLab Mingling · Admin
              </p>
              <h1 className="text-4xl font-bold text-white mt-1">
                {rows.length}명 제출됨
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearAll}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm hover:bg-zinc-800"
                disabled={rows.length === 0}
              >
                전체 삭제
              </button>
              <button
                onClick={generate}
                disabled={rows.length < 2}
                className="px-6 py-3 rounded-xl bg-white text-black font-bold disabled:bg-zinc-800 disabled:text-zinc-600"
              >
                그룹 편성하기 →
              </button>
            </div>
          </header>

          <div className="grid grid-cols-6 gap-2">
            {([1, 2, 3, 4, 5, 6] as const).map((t, i) => (
              <div
                key={t}
                className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 text-center"
              >
                <div
                  className={`w-3 h-3 rounded-full mx-auto mb-2 ${TEAM_COLORS[i]}`}
                />
                <div className="text-zinc-500 text-xs">{t}조</div>
                <div className="text-2xl font-bold text-white mt-1">
                  {teamCounts[t]}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5">
            <h3 className="text-zinc-400 text-sm font-medium mb-3">
              제출자 목록 ({rows.length})
            </h3>
            {!loaded ? (
              <div className="text-zinc-600 text-sm">불러오는 중...</div>
            ) : rows.length === 0 ? (
              <div className="text-zinc-600 text-sm py-8 text-center">
                아직 제출자가 없어요. QR을 띄워주세요.
              </div>
            ) : (
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-900 rounded-xl"
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${teamColor(
                        r.original_team
                      )}`}
                    />
                    <span className="text-white text-sm font-medium">
                      {r.name}
                    </span>
                    <span className="text-zinc-500 text-xs ml-auto">
                      {r.original_team}조
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-zinc-700 text-xs">
            adminKey={adminKey ? "✓" : "✗"} · session={SESSION_ID} · 폴링{" "}
            {POLL_MS}ms
          </p>
        </section>
      </div>
    </main>
  );
}

function ResultView({
  result,
  onBack,
  onReroll,
}: {
  result: GroupingResult;
  onBack: () => void;
  onReroll: () => void;
}) {
  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-end justify-between gap-4 mb-8 flex-wrap">
          <div>
            <p className="text-zinc-500 text-sm uppercase tracking-widest">
              그룹 편성 결과
            </p>
            <h1 className="text-4xl font-bold text-white mt-1">
              {result.groups.length}개 그룹
            </h1>
            {result.totalViolations > 0 ? (
              <p className="mt-2 text-amber-400 text-sm">
                같은 조원이 묶인 쌍: {result.totalViolations}개 (불가피)
              </p>
            ) : (
              <p className="mt-2 text-emerald-400 text-sm">
                같은 조원 겹침 없이 편성 완료 ✓
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300"
            >
              ← 돌아가기
            </button>
            <button
              onClick={onReroll}
              className="px-6 py-3 rounded-xl bg-white text-black font-bold"
            >
              ↻ 다시 편성
            </button>
          </div>
        </header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {result.groups.map((g) => (
            <div
              key={g.id}
              className={`rounded-3xl p-6 border-2 ${
                g.violations > 0
                  ? "border-amber-700 bg-amber-950/30"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              <div className="flex items-baseline justify-between mb-4">
                <div className="text-zinc-500 text-sm uppercase tracking-widest">
                  Group
                </div>
                <div className="text-5xl font-bold text-white tabular-nums">
                  {g.id}
                </div>
              </div>
              <ul className="space-y-2">
                {g.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-zinc-900 rounded-xl"
                  >
                    <span className="text-white text-xl font-bold">
                      {m.name}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full text-white ${teamColor(
                        m.original_team
                      )}`}
                    >
                      {m.original_team}조
                    </span>
                  </li>
                ))}
              </ul>
              {g.violations > 0 && (
                <div className="mt-3 text-amber-400 text-xs">
                  ⚠ 같은 조원 {g.violations}쌍 포함
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
