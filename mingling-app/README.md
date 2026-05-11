# DaoLab Mingling

당일 워크샵에서 QR로 참가자 정보(이름·소속조)를 받고, 진행자가 버튼 한 번으로 같은 원래 조원을 가급적 회피한 **3인 1조 그룹**을 자동 편성하는 웹앱.

**0 클라우드 가입.** 데이터는 로컬 SQLite 파일 (`data/mingling.db`)에 저장됩니다.

## 주요 기능

- 📱 **참가자 페이지** (`/`) — QR로 접속, 이름·조 입력 후 제출
- 🖥 **진행자 페이지** (`/admin?key=...`) — 큰 QR + 실시간 제출 현황(1.5초 폴링) + 그룹 편성 버튼
- ✨ **알고리즘** — 같은 조원 회피 best-effort, 200회 시도 후 위반 최소 결과 채택
- 🔄 **다시 편성** — 마음에 안 들면 다른 시드로 재시도
- 🔒 **진행자 가드** — `ADMIN_KEY` 환경변수로 `/admin` 보호

## 빠른 시작 (1분)

```bash
cd mingling-app
cp .env.example .env.local
# .env.local 안의 ADMIN_KEY를 본인이 정한 값으로 바꿔주세요
npm install
npm run dev
```

- 참가자 페이지: http://localhost:3000
- 진행자 페이지: http://localhost:3000/admin?key=daolab-2026-CHANGE-ME

처음 실행하면 `data/mingling.db` 파일이 자동 생성됩니다.

## 행사 당일 시나리오

같은 와이파이를 쓰는 상황이라면 **로컬 PC를 서버로 사용**하는 게 가장 간단:

1. **본인 노트북에서** `npm run dev` 실행
2. 노트북 IP 확인: `ipconfig getifaddr en0` (예: `192.168.0.42`)
3. 참가자에게 `http://192.168.0.42:3000` 안내 (진행자 페이지가 표시하는 QR 코드 사용)
4. 진행자 화면: `http://localhost:3000/admin?key=...` (또는 같은 IP)

### 인터넷 공개가 필요하면 (다른 와이파이/원격)

**ngrok 사용 (5분, 무료)**

```bash
# 1. https://ngrok.com 회원가입 → authtoken 받기
# 2. 다른 터미널에서:
npx ngrok http 3000
# → https://xxxx.ngrok-free.app 같은 공개 URL 생김
```

진행자 페이지의 QR이 자동으로 `window.location.origin` 기반으로 생성되니, ngrok URL로 접속한 다음 QR을 띄우면 그 QR이 ngrok URL로 연결됩니다.

### 다른 배포 옵션

| 옵션 | 난이도 | 비고 |
|---|---|---|
| 로컬 + 같은 와이파이 | ★ | 가장 쉬움. 노트북 꺼지면 끝 |
| 로컬 + ngrok | ★★ | 외부에서도 접속. 노트북 꺼지면 끝 |
| Railway / Fly.io / Render | ★★★ | 영구 호스팅. SQLite 디스크 영속화 필요 |
| Vercel | ✕ | SQLite 사용 불가 (serverless ephemeral fs) — 클라우드 DB로 갈아타야 함 |

## 행사 후 데이터 정리

- 진행자 페이지 우측 상단 **"전체 삭제"** 버튼 (서버 API가 ADMIN_KEY 검증 후 삭제)
- 또는 파일 통째로 삭제:
  ```bash
  rm mingling-app/data/mingling.db
  ```

## 알고리즘 동작

`lib/grouping.ts`의 `formGroups()`:

1. 인원 N에서 그룹 개수 = `floor(N/3)`. 나머지 r은 r개 그룹을 4인으로.
2. 시드를 바꿔가며 200~300회 시도:
   - 조별 큐 셔플
   - 라운드 로빈으로 각 그룹에 한 명씩 채움
   - 후보 선택: 현재 그룹에 같은 조원이 없는 사람 우선, 없으면 가장 인원 많은 조에서 차출 (균형)
3. 위반 수(같은 조원 쌍) 최소 결과 반환

**예상 결과 (30명, 6조 × 5명):** 위반 0
**한 조 쏠림 (예: 1조 10명):** 위반 ≤ 5 best-effort

## 테스트

```bash
npm test
```

`lib/grouping.test.ts` — 9개 케이스 (균형/불균형/엣지케이스/결정성).

## 폴더 구조

```
mingling-app/
├── app/
│   ├── page.tsx                   참가자 폼
│   ├── thanks/page.tsx            제출 완료
│   ├── admin/page.tsx             진행자
│   ├── api/
│   │   ├── participants/route.ts  GET/POST 참가자
│   │   └── admin/clear/route.ts   POST 전체삭제 (ADMIN_KEY 가드)
│   ├── _components/
│   │   ├── ParticipantForm.tsx
│   │   └── AdminConsole.tsx
│   ├── globals.css
│   └── layout.tsx
├── lib/
│   ├── db.ts                      SQLite (better-sqlite3)
│   ├── grouping.ts                알고리즘 (순수 함수)
│   ├── grouping.test.ts
│   └── session.ts
├── data/
│   └── mingling.db                자동 생성 (gitignored)
├── middleware.ts                  /admin 가드
├── .env.example
└── README.md
```

## 운영 팁

- **참가자가 이름 오타** 같은 이름으로 다시 제출하면 덮어쓰기됨 (`session_id, name` UNIQUE)
- **세션 분리** `NEXT_PUBLIC_SESSION_ID`를 행사명으로 (예: `cave-2026-04`). 다른 세션끼리 격리됨
- **인원 4의 배수가 좋다** N이 3의 배수이면 모든 그룹 3인. 그 외에는 일부 4인 그룹

## 라이선스 / 출처

DaoLab 내부 워크샵용. 자유 사용.
