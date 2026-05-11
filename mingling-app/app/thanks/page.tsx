import Link from "next/link";

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; team?: string }>;
}) {
  const { name, team } = await searchParams;
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-10 text-center">
      <div className="text-6xl mb-6">✓</div>
      <h1 className="text-3xl font-bold text-white">제출 완료!</h1>
      {name && (
        <p className="mt-4 text-zinc-300 text-lg">
          <span className="font-semibold text-white">{name}</span>
          {team ? ` · ${team}조` : ""}
        </p>
      )}
      <p className="mt-6 text-zinc-400 text-sm leading-relaxed max-w-xs">
        진행자가 모두의 제출이 끝나면
        <br />
        새 그룹을 발표할 거예요.
      </p>
      <Link
        href="/"
        className="mt-10 text-sm text-zinc-500 underline underline-offset-4"
      >
        다시 제출하기
      </Link>
    </main>
  );
}
