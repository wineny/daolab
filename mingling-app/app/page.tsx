import { ParticipantForm } from "./_components/ParticipantForm";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <p className="text-sm uppercase tracking-widest text-zinc-500">
            DaoLab Mingling
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            새로운 사람과 만나봐요
          </h1>
          <p className="mt-3 text-zinc-400 text-sm leading-relaxed">
            이름과 현재 소속된 조를 입력해주세요.
            <br />
            진행자가 다른 조원들과 섞어 새 그룹을 만들어요.
          </p>
        </header>
        <ParticipantForm />
      </div>
    </main>
  );
}
