"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TEAMS = [1, 2, 3, 4, 5, 6] as const;

export function ParticipantForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [team, setTeam] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    name.trim().length > 0 && name.trim().length <= 20 && team !== null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const trimmed = name.trim();
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, original_team: team }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "제출 실패");
      }
      router.push(
        `/thanks?name=${encodeURIComponent(trimmed)}&team=${team}`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "제출 중 오류가 발생했어요";
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          이름
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoComplete="off"
          inputMode="text"
          placeholder="예: 김다오"
          className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 px-5 py-4 text-lg text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
          disabled={submitting}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-3">
          현재 소속 조
        </label>
        <div className="grid grid-cols-3 gap-3">
          {TEAMS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTeam(t)}
              disabled={submitting}
              className={`py-5 rounded-2xl text-2xl font-bold transition border-2 ${
                team === t
                  ? "bg-white text-black border-white"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800 active:bg-zinc-800"
              }`}
            >
              {t}조
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-950/60 border border-red-900 text-red-300 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!valid || submitting}
        className="w-full rounded-2xl bg-white text-black py-5 text-lg font-bold disabled:bg-zinc-800 disabled:text-zinc-600 transition"
      >
        {submitting ? "제출 중..." : "제출하기"}
      </button>
    </form>
  );
}
