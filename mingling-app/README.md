# DaoLab Mingling

당일 워크샵에서 QR로 참가자 정보(이름·소속조)를 받고, 진행자가 버튼 한 번으로 같은 원래 조원을 가급적 회피한 **3인 1조 그룹**을 자동 편성하는 웹앱.

**저장소: 본인 구글 시트.** 데이터베이스 가입·관리 없이, 본인이 만든 스프레드시트가 곧 DB.

## 주요 기능

- 📱 **참가자 페이지** (`/`) — QR로 접속, 이름·조 입력 후 제출
- 🖥 **진행자 페이지** (`/admin?key=...`) — 큰 QR + 실시간 제출 현황(1.5초 폴링) + 그룹 편성 버튼
- ✨ **알고리즘** — 같은 조원 회피 best-effort, 200~300회 시도 후 위반 최소 결과 채택
- 🔄 **다시 편성** — 마음에 안 들면 다른 시드로 재시도
- 🔒 **진행자 가드** — `ADMIN_KEY` 환경변수로 `/admin` 보호
- 🌐 **어디서든 접속** — 백엔드가 구글 시트라 본인 노트북이 꺼져있어도 동작

## 빠른 시작

### 1. 백엔드 (구글 시트 + Apps Script) 셋업 — 5분, 1회만

📖 **[google-apps-script/SETUP.md](./google-apps-script/SETUP.md)** 의 7단계를 따라가면 됩니다.

요약:
1. 빈 구글 시트 생성
2. 확장 프로그램 → Apps Script → `Code.gs` 붙여넣기
3. Script Properties에 `ADMIN_KEY` 등록
4. `setupSheet` 함수 1회 실행 (헤더 자동 생성)
5. 웹 앱으로 배포 → URL 복사

### 2. Next.js 앱 띄우기

```bash
cd mingling-app
cp .env.example .env.local
# .env.local 의 GOOGLE_SHEET_API_URL, ADMIN_KEY 채우기
npm install
npm run dev
```

- 참가자 페이지: http://localhost:3000
- 진행자 페이지: http://localhost:3000/admin?key=YOUR_ADMIN_KEY

### 3. (선택) Vercel 배포

```bash
npx vercel
```

또는 GitHub에 push 후 https://vercel.com 에서 import.

배포 후 **Project Settings → Environment Variables** 에 `.env.local`의 3개 값 추가:
- `GOOGLE_SHEET_API_URL`
- `ADMIN_KEY`
- `NEXT_PUBLIC_SESSION_ID`

배포 URL이 영구 공개되므로, 행사 당일 이 URL의 QR을 빔프로젝터에 띄우면 됩니다.

## 행사 당일 시나리오

**준비 (5분)**
1. 빔프로젝터에 진행자 페이지 띄우기 (`/admin?key=...`)
2. 화면 좌측의 큰 QR 코드 또는 URL을 안내
3. 새 행사면 `NEXT_PUBLIC_SESSION_ID` 를 행사명으로 변경 (예: `cave-2026-04`) → 깨끗한 새 세션 시작

**참가자 (1분)**
1. QR 스캔 → 이름·조 입력 → 제출
2. "제출 완료" 화면 → 진행자 안내 대기

**진행 (1분)**
1. 모두 제출 확인 (실시간 카운트, 1.5초 폴링)
2. "그룹 편성하기" 클릭
3. 결과 화면을 빔프로젝터에 표시
4. 마음에 안 들면 "↻ 다시 편성"

**행사 후 데이터 정리**
- 진행자 페이지 우측 상단 "전체 삭제" 버튼 (현재 세션만 삭제)
- 또는 시트에서 직접 행 삭제

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
│   │   ├── participants/route.ts  GET/POST → Apps Script proxy
│   │   └── admin/clear/route.ts   POST 전체삭제 (ADMIN_KEY 가드)
│   ├── _components/
│   │   ├── ParticipantForm.tsx
│   │   └── AdminConsole.tsx
│   ├── globals.css
│   └── layout.tsx
├── lib/
│   ├── sheets.ts                  Apps Script HTTP 클라이언트
│   ├── grouping.ts                알고리즘 (순수 함수)
│   ├── grouping.test.ts
│   └── session.ts
├── google-apps-script/
│   ├── Code.gs                    Apps Script 코드 (붙여넣기용)
│   └── SETUP.md                   ★ 시트 셋업 가이드
├── middleware.ts                  /admin 가드
├── .env.example
└── README.md
```

## 운영 팁

- **참가자 이름 오타** 같은 이름으로 다시 제출하면 덮어쓰기됨 (Apps Script가 `session_id+name` 으로 upsert). 또는 시트에서 직접 수정 가능.
- **세션 분리** `NEXT_PUBLIC_SESSION_ID`를 행사명으로 (예: `cave-2026-04`). 다른 세션끼리 격리됨.
- **인원 4의 배수가 좋다** N이 3의 배수면 모든 그룹 3인. 그 외엔 일부 4인 그룹.
- **Apps Script 호출 제한** 분당 ~100회 정도라 30명 워크샵은 충분히 여유. 폴링 주기를 줄이려면 `app/_components/AdminConsole.tsx`의 `POLL_MS` 상수 조정.

## 보안 메모

- 시트는 본인 계정 소유 → 다른 사람이 시트 자체에 접근 불가
- Apps Script는 본인 권한으로 시트에 접근 → API URL이 노출돼도 시트 권한은 변하지 않음
- 누군가 API URL을 알면 임의의 `name/team` 데이터를 제출할 수 있음 (DDoS 우려 시 `NEXT_PUBLIC_SESSION_ID` 를 알기 어려운 값으로 변경)
- 삭제는 `ADMIN_KEY` 검증 후에만 (Apps Script + Next.js 양쪽 모두 검증)

## 라이선스 / 출처

DaoLab 내부 워크샵용. 자유 사용.
