"use client";

import { useEffect, useState } from "react";

const TOTAL_STEPS = 4;
const TIMER_INITIAL_SECONDS = 25 * 60;

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useTimer(initialSeconds: number) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isRunning) return;
    if (secondsLeft <= 0) {
      setIsRunning(false);
      return;
    }
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, secondsLeft]);

  return {
    secondsLeft,
    isRunning,
    start: () => setIsRunning(true),
    pause: () => setIsRunning(false),
    reset: () => {
      setIsRunning(false);
      setSecondsLeft(initialSeconds);
    },
    adjust: (deltaMinutes: number) =>
      setSecondsLeft((s) => Math.max(0, s + deltaMinutes * 60)),
  };
}

type TimerApi = ReturnType<typeof useTimer>;

export function MinglingGuide({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState(0);
  const timer = useTimer(TIMER_INITIAL_SECONDS);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight")
        setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
      else if (e.key === "Escape") onExit();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onExit]);

  function handleNext() {
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  }
  function handlePrev() {
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-8 py-5 flex items-center justify-between border-b border-zinc-900">
        <button
          onClick={onExit}
          className="text-zinc-500 text-sm hover:text-white"
        >
          ← 그룹 보기
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-10 rounded-full ${
                i <= step ? "bg-white" : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
        <div className="text-zinc-600 text-sm tabular-nums">
          {step + 1} / {TOTAL_STEPS}
        </div>
      </header>

      <section className="flex-1 px-8 py-12 max-w-5xl mx-auto w-full">
        {step === 0 && <StepRules />}
        {step === 1 && <StepQuestions />}
        {step === 2 && <StepTimer timer={timer} />}
        {step === 3 && <StepShare />}
      </section>

      <footer className="px-8 py-5 flex items-center justify-between border-t border-zinc-900">
        <button
          onClick={handlePrev}
          disabled={step === 0}
          className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-30"
        >
          ← 이전
        </button>
        <p className="text-zinc-700 text-xs hidden sm:block">
          ← → 키로도 이동 · ESC로 그룹 화면 복귀
        </p>
        <button
          onClick={handleNext}
          disabled={step === TOTAL_STEPS - 1}
          className="px-6 py-2.5 rounded-xl bg-white text-black font-bold disabled:opacity-30"
        >
          다음 →
        </button>
      </footer>
    </main>
  );
}

function StepRules() {
  return (
    <div>
      <p className="text-zinc-500 text-sm uppercase tracking-widest mb-3">
        Step 1 · 오프닝
      </p>
      <h1 className="text-5xl font-bold text-white leading-tight mb-10">
        새로 만난 사람과<br />
        편하게 이야기해봐요
      </h1>
      <ul className="space-y-5 text-2xl text-zinc-200 leading-relaxed">
        <li>• 같은 조 말고, 새로운 사람들과 친해져요</li>
        <li>
          •{" "}
          <span className="text-white font-bold">
            2개의 진실 &amp; 1개의 거짓
          </span>{" "}
          — 서로의 의외의 면을 발견해봐요
        </li>
        <li>• 게임에서 나온 이야기로 대화를 이어가요</li>
      </ul>
    </div>
  );
}

function StepQuestions() {
  const statements = [
    "사내 연애를 해서 결혼까지 하게 되었다",
    "신사에서 5년 와인바 하고 매각까지 했다",
    "커뮤니티 이벤트를 1000번 넘게 진행했다",
  ];
  return (
    <div>
      <p className="text-zinc-500 text-sm uppercase tracking-widest mb-3">
        Step 2 · 직접 해볼까요
      </p>
      <h1 className="text-5xl font-bold text-white leading-tight mb-4">
        2개의 진실 &amp; 1개의 거짓
      </h1>
      <p className="text-zinc-400 text-xl mb-10">
        나에 대한 3가지 중 1개는 거짓 — 다른 사람들이 거짓을 맞혀봐요
      </p>

      <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="text-zinc-400 text-sm uppercase tracking-widest">
            예시 · 윤누리
          </span>
        </div>
        <ol className="space-y-5">
          {statements.map((s, i) => (
            <li key={i} className="flex gap-4 text-2xl text-zinc-100">
              <span className="text-zinc-600 font-bold tabular-nums">
                {i + 1}.
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-zinc-500 text-base mt-8">
        지금 다 같이 거짓을 찾아보고 → 그 다음 조별로 진행하세요
      </p>
    </div>
  );
}

function StepTimer({ timer }: { timer: TimerApi }) {
  const done = timer.secondsLeft === 0;
  return (
    <div className="flex flex-col items-center justify-center">
      <p className="text-zinc-500 text-sm uppercase tracking-widest mb-3">
        Step 3 · 조별 게임 시작
      </p>
      <h2 className="text-4xl font-bold text-white mb-10">
        조원의 거짓을 찾아봐요
      </h2>
      <div
        className={`text-[12rem] leading-none font-bold tabular-nums tracking-tight ${
          done ? "text-amber-400" : "text-white"
        }`}
      >
        {formatTime(timer.secondsLeft)}
      </div>
      {done && (
        <p className="text-amber-400 text-xl mt-4">시간이 다 됐어요</p>
      )}
      <div className="flex gap-3 mt-12 flex-wrap justify-center">
        {timer.isRunning ? (
          <button
            onClick={timer.pause}
            className="px-8 py-3 rounded-xl bg-white text-black font-bold text-lg"
          >
            ⏸ 일시정지
          </button>
        ) : (
          <button
            onClick={timer.start}
            disabled={done}
            className="px-8 py-3 rounded-xl bg-white text-black font-bold text-lg disabled:opacity-30"
          >
            ▶ 시작
          </button>
        )}
        <button
          onClick={timer.reset}
          className="px-5 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300"
        >
          ↻ 리셋
        </button>
        <button
          onClick={() => timer.adjust(-1)}
          className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300"
        >
          −1분
        </button>
        <button
          onClick={() => timer.adjust(1)}
          className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300"
        >
          +1분
        </button>
      </div>
    </div>
  );
}

function StepShare() {
  return (
    <div>
      <p className="text-zinc-500 text-sm uppercase tracking-widest mb-3">
        Step 4 · 전체 공유
      </p>
      <h1 className="text-5xl font-bold text-white leading-tight mb-4">
        가장 흥미로운 진실
      </h1>
      <p className="text-zinc-400 text-xl mb-10">
        우리 조에서 들은 이야기 중에서
      </p>
      <ul className="space-y-5 text-2xl text-zinc-200 leading-relaxed">
        <li>
          • 들었던 진실 중 가장 인상 깊었던 것{" "}
          <span className="text-white font-bold">한 개</span>
        </li>
        <li>
          • 본인 말고,{" "}
          <span className="text-white font-bold">다른 조원이</span> 그 사람을
          소개해줘요
        </li>
      </ul>
    </div>
  );
}
