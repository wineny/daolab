# Google Sheets + Apps Script 셋업 (5분, 1회만)

이 가이드대로 따라하면 우리 앱이 사용할 백엔드(시트 + Apps Script Web App)가 완성됩니다.

## 1. 구글 시트 만들기 (1분)

1. https://sheets.google.com 에서 **빈 스프레드시트** 생성
2. 시트 이름은 자유롭게 (예: `daolab-mingling`)

## 2. Apps Script 코드 붙여넣기 (2분)

1. 시트 메뉴 → **확장 프로그램 → Apps Script**
2. 기본 `myFunction` 코드를 모두 지우고, [`Code.gs`](./Code.gs) 의 내용을 통째로 붙여넣기
3. 좌측 상단 프로젝트 이름을 클릭해 의미 있게 변경 (예: `daolab-mingling-api`)
4. 💾 저장 (Cmd/Ctrl + S)

## 3. ADMIN_KEY 등록 (30초)

진행자 페이지 가드용 비밀 키를 Script Properties에 저장:

1. Apps Script 좌측 사이드바 ⚙️ **프로젝트 설정**
2. 하단 **스크립트 속성** → **속성 추가**
3. 속성: `ADMIN_KEY`
4. 값: `daolab-2026-secret` (본인이 정한 비밀 문자열, 영문·숫자·하이픈)
5. **스크립트 속성 저장**

## 4. 시트 초기화 (10초)

Apps Script 편집기 상단:
1. 함수 드롭다운에서 `setupSheet` 선택
2. ▶ **실행** 클릭
3. 처음 실행하면 권한 요청 — "권한 검토" → 본인 계정 선택 → "고급" → "안전하지 않음(이동)" → "허용"
4. 시트 탭으로 돌아가면 `participants` 시트가 헤더와 함께 생성되어 있음

## 5. 웹 앱으로 배포 (1분)

1. Apps Script 우측 상단 **배포** → **새 배포**
2. ⚙️ 톱니바퀴 → **웹 앱**
3. 설정:
   - **설명**: `daolab mingling v1` (자유)
   - **다음 사용자로 실행**: **나** (본인 계정)
   - **액세스 권한이 있는 사용자**: **모든 사용자** ← 중요
4. **배포**
5. 권한 한 번 더 요청되면 허용
6. 마지막 화면에 표시되는 **웹 앱 URL** 복사 (`https://script.google.com/macros/s/AKfy.../exec` 형식)

## 6. Next.js 앱에 URL 등록

`mingling-app/.env.local` 파일에 두 줄 추가/수정:

```env
GOOGLE_SHEET_API_URL=여기에_방금_복사한_웹앱_URL_붙여넣기
ADMIN_KEY=daolab-2026-secret
NEXT_PUBLIC_SESSION_ID=default
```

**중요**: `ADMIN_KEY`는 위 3단계에서 Apps Script 속성에 넣은 것과 **정확히 같은 문자열**이어야 합니다.

## 7. 동작 확인

```bash
cd mingling-app
npm run dev
```

브라우저에서:
- http://localhost:3000 (참가자) → 이름·조 입력 → 제출
- 시트 탭 새로고침 → 새 행이 추가되어 있어야 함
- http://localhost:3000/admin?key=daolab-2026-secret → 제출자 보임 → 그룹 편성 확인

## 코드 수정했을 때

Apps Script 코드를 고쳤으면:
- **배포** → **배포 관리** → 기존 배포 우측 ✏️ → **새 버전** → **배포**
- 같은 URL이 유지됨 (재배포만 하면 즉시 반영)

## 자주 묻는 질문

**Q. "이 앱은 인증되지 않았습니다" 경고가 떠요**
→ 본인 계정으로 본인 시트만 다루는 거라 안전합니다. "고급" → "안전하지 않음으로 이동" → "허용".

**Q. 시트를 다른 사람에게 공유해야 하나요?**
→ 아니요. Apps Script가 본인 권한으로 시트에 접근하므로, 시트는 본인만 보면 됩니다.

**Q. 다른 행사에서 재사용하려면?**
→ `.env.local`의 `NEXT_PUBLIC_SESSION_ID`를 행사명으로 바꾸세요 (예: `cave-2026-04`). 같은 시트에 여러 행사 데이터가 같이 쌓이지만 세션별로 분리됩니다.

**Q. 데이터 삭제는?**
→ 진행자 페이지의 "전체 삭제" 버튼 (현재 세션만 삭제). 또는 시트에서 직접 행 삭제.

**Q. 누가 마구 제출하면?**
→ Apps Script 분당 호출 제한 안에서는 동작합니다 (30~50명 워크샵은 충분). 악의적 트래픽 우려면 `NEXT_PUBLIC_SESSION_ID`를 알기 어려운 값으로 설정.
