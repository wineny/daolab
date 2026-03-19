# DaoLab 봇 v4 — 똑똑하게 만들기 (Plan Plus)

> **Feature**: daolab-bot-smart
> **Date**: 2026-03-19
> **Author**: wine_ny
> **Method**: Plan Plus (Intent Discovery + Alternatives + YAGNI + bbojjak 레슨 접목)
> **Base**: v3 Plan 계승 + bbojjak-viewer 19개 레슨 인사이트 반영

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | DaoLab 봇 v4 — 4대 핵심 기능 추가 (히스토리/기억/Cron/관리자) |
| 시작일 | 2026-03-19 |
| 예상 기간 | 1-2일 |

| 관점 | 내용 |
|------|------|
| **Problem** | PM2 재시작 시 대화 맥락 소실, "기억해줘" 기능 미구현 (SOUL.md 규칙만 존재), 능동적 메시징 부재, 관리자 도구 없음 |
| **Solution** | Discord API 히스토리 복원 + memory/ 파일 영구화 + node-cron 주간다이제스트/리마인더 + /admin 슬래시 커맨드 |
| **Function UX Effect** | 봇 재시작해도 대화 이어감, "기억해줘"가 실제로 작동, 매주 월요일 주간요약 자동 발송, 관리자가 봇 상태를 실시간 제어 |
| **Core Value** | 봇이 "한 번 물어보면 답하는 도구"에서 "멤버와 함께 성장하는 커뮤니티 동료"로 진화 |

---

## 1. User Intent Discovery

### 1.1 핵심 문제
다오랑(오랑) 봇이 이미 Gemini AI + knowledge 기반 답변 + 웹검색을 갖추고 있지만, **운영 안정성**과 **능동성**이 부족하다.

### 1.2 대상 사용자
- **다오랩 7기 멤버 32명**: 봇에 질문하고, 지식을 공유하고, 주간 요약을 받는 주 사용자
- **관리자 (wine_ny)**: 봇을 운영하고 지식을 관리하는 유일한 관리자 (ID: 925580658917646397)

### 1.3 성공 기준
1. PM2 재시작 후에도 채널별 대화 맥락이 유지된다
2. "기억해줘" 명령이 실제로 파일에 저장되고, "기억 보여줘"로 조회된다
3. 매주 월요일 09:00 주간다이제스트가 자동 발송된다
4. 관리자가 /admin 명령으로 봇 상태를 확인하고 제어할 수 있다

---

## 2. bbojjak 레슨 인사이트 접목

### 2.1 직접 적용 (이번 구현)

| 레슨 | 핵심 통찰 | 적용 방식 |
|------|----------|----------|
| #06 세션 관리 | 채널별 분리 + 파일로 cross-session 연결 | history.mjs: 재시작 시 Discord API로 최근 메시지 복원 |
| #08 메모리 3단계 | 세션→파일→시스템 승격 구조 | memory.mjs: "기억해줘" → 즉시 파일 영구화 (컴팩션 피해 방지) |
| #09 Heartbeat/Cron | Cron=정시배달(단일작업, 높은정확도) | scheduler.mjs: node-cron으로 시간조건 명시 + 중복방지 |
| #02 SOUL.md | "하면 안 되는 것"이 더 중요 | admin.mjs: 관리자 ID 코드레벨 검증, 비관리자 요청 차단 |

### 2.2 향후 적용 (TODO)

| 레슨 | 핵심 통찰 | 향후 적용 |
|------|----------|----------|
| #05 오류학습 | 구체적 규칙 > 추상 원칙 | learnings.md에 봇 실수/개선사항 기록 |
| #16 토큰최적화 | 읽기가 쓰기보다 비쌈 | 히스토리 30개 초과 시 요약 압축 |
| #09 Heartbeat | Heartbeat=순찰(여러작업, 낮은정확도) | 6시간마다 일정/메모리 변경 순찰 |
| #17 보안 | 인젝션 3유형 방어, 최소 권한 | 프롬프트 인젝션 필터링 코드 구현 |

---

## 3. Alternatives Explored

### 3.1 아키텍처 비교

| 접근 | 설명 | 판정 |
|------|------|------|
| **A. 모듈형 확장** | 기존 3파일 + 새 모듈 4개 추가. 파일당 200줄 이하 | ✅ **채택** |
| B. 단일 파일 확장 | bot.mjs/chat.mjs에 모든 기능 추가. 파일당 400줄+ | ❌ 유지보수 어려움 |
| C. 클래스 기반 리팩토링 | 전체 재설계. 가장 체계적이지만 기존 코드 전면 수정 | ❌ 과잉 엔지니어링 |

---

## 4. YAGNI Review

### 4.1 DO (이번 구현)

| # | 기능 | 새 파일 | 의존성 |
|---|------|---------|--------|
| 1 | 히스토리 복원 | history.mjs | 없음 (Discord.js 내장) |
| 2 | 기억하기 (memory/) | memory.mjs | 없음 (fs 내장) |
| 3 | Cron 다이제스트+리마인더 | scheduler.mjs | node-cron (새 의존성) |
| 4 | 관리자 명령어 | admin.mjs + commands/admin.mjs | 없음 |

### 4.2 DEFER (TODO)

| # | 기능 | 시기 | 이유 |
|---|------|------|------|
| 5 | 오류학습 (learnings.md) | v5 | 운영 데이터 축적 후 |
| 6 | 토큰 최적화 (컨텍스트 압축) | v5 | 현재 히스토리 40개로 충분 |
| 7 | Heartbeat 순찰 시스템 | v5 | Cron으로 커버 가능한 범위 |
| 8 | 보안 코드 검증 | v5 | SOUL.md 규칙으로 1차 방어 중 |

---

## 5. Feature Specification

### Feature 1: 히스토리 복원 (history.mjs)

**문제**: PM2 재시작 시 `channelHistories` Map이 초기화 → 대화 맥락 소실
**해법**: ClientReady 이벤트에서 Discord API로 최근 메시지를 fetch하여 복원

**핵심 함수**:
```
restoreAll(client)
  → client.guilds.cache의 모든 텍스트 채널 순회
  → 각 채널에서 channel.messages.fetch({ limit: 20 })
  → 시간순 정렬 → chat.addContext()로 주입
  → 봇 자신의 메시지는 role: "model"로 구분
```

**레슨#06 적용**:
- 채널별 독립 복원 (세션 분리 유지)
- 20개만 가져와서 과도한 API 호출 방지
- 에러 발생 시 해당 채널만 건너뛰기 (다른 채널에 영향 없음)

**주의사항**:
- Rate limit: 채널 간 100ms 딜레이 추가
- 봇 메시지 구분: `message.author.id === client.user.id` 확인
- 권한 없는 채널은 조용히 건너뛰기

### Feature 2: 기억하기 (memory.mjs)

**문제**: SOUL.md에 "기억해줘" 규칙이 정의되어 있지만 실제 파일 쓰기 코드가 없음
**해법**: memory.mjs에서 패턴 감지 → 카테고리별 .md 파일에 append

**핵심 함수**:
```
detect(message) → boolean
  "기억해줘", "이거 기억해", "저장해줘" 패턴 매칭
  → URL 포함: shared_links.md에 저장
  → 텍스트: shared_knowledge.md에 저장
  → 형식: "- [2026-03-19] @닉네임: 내용"
  → return true (감지됨)

list(category?) → string
  memory/ 폴더의 파일 읽어서 카테고리별 요약
  최근 5개 항목 위주 표시

search(keyword) → string
  memory/ 파일에서 키워드 검색
  관련 항목 반환

remove(lineContent, userId) → boolean
  관리자 ID 검증 후 해당 라인 삭제
```

**레슨#08 적용**:
- 3단계 기억 구조: 세션(channelHistories) → 파일(memory/) → 시스템(knowledge/)
- "기억해줘" = 세션→파일 승격 트리거
- 중요 정보 즉시 파일 영구화 (컴팩션 피해 방지)

**memory/ 폴더 구조**:
```
daolab-bot/memory/
├─ shared_links.md       # URL/링크 저장
├─ shared_knowledge.md   # 텍스트 지식 저장
└─ shared_files.md       # 파일 첨부 설명 저장
```

**민감정보 차단** (SOUL.md 규칙 코드화):
- 전화번호, 주소, 비밀번호 패턴 감지 시 저장 거절
- "그건 민감한 정보라 저장하지 않는 게 좋겠어!"

### Feature 3: Cron 스케줄러 (scheduler.mjs)

**문제**: 봇이 반응형(reactive)에 그침 → 능동적(proactive) 메시징 부재
**해법**: node-cron으로 주간다이제스트 + 모임리마인더 자동 발송

**의존성 추가**: `node-cron` (package.json에 추가)

**발송 채널**: `1484166024923316344` (하드코딩)

**핵심 작업**:

```
1. 주간 다이제스트 (월요일 09:00 KST)
   weeklyDigest(client)
   → 02_7gi_schedule.md에서 이번 주 일정 파싱
   → memory/ 폴더에서 최근 1주일 항목 수집
   → 현재 주차 계산 → 주차별 맞춤 안내 추가
   → 채널에 포스팅

2. 모임 리마인더 (화요일 09:00 KST)
   meetingReminder(client)
   → 02_7gi_schedule.md에서 오늘 일정 확인
   → 일정 있으면 → 채널에 리마인더 포스팅
   → 없으면 → 아무것도 안 함 (중복방지)
```

**레슨#09 적용**:
- Cron = 정시배달 패턴 (단일 작업, 높은 정확도)
- 시간조건 명시: `0 0 * * 1` (UTC 00:00 = KST 09:00)
- 중복 실행 방지: 발송 후 마지막 발송 시간 기록
- activeHours 개념: 09:00 발송으로 새벽 실행 방지

**다이제스트 형식** (SOUL.md 주간 다이제스트 규칙 준수):
```
🏛️ 다오랩 주간 다이제스트 (3/17 ~ 3/23)

📅 이번 주 일정
- 3/18(화) 19:00 정기모임 @ 강남캠퍼스

📝 최근 공유된 지식 (N건)
- [요약 항목들]

💡 이번 주 포인트
- [주차별 맞춤 안내]
```

### Feature 4: 관리자 명령어 (admin.mjs)

**문제**: 봇 관리를 위해 매번 SSH 접속 필요 → 비효율적
**해법**: /admin 슬래시 커맨드로 디스코드 내에서 봇 제어

**관리자 ID**: `925580658917646397` (SOUL.md에 정의된 값)

**서브커맨드**:
```
/admin reload
  → knowledge/ 파일 전체 리로드
  → chat.mjs의 모델 재초기화
  → "knowledge N개 파일 리로드 완료!"

/admin memory [list|delete]
  → list: memory/ 파일별 항목 수 + 최근 3개
  → delete [키워드]: 해당 항목 삭제

/admin status
  → uptime, 채널 수, 히스토리 크기, 마지막 다이제스트 시간
  → ephemeral (관리자만 보임)
```

**보안**: 모든 서브커맨드 실행 전 `interaction.user.id === ADMIN_ID` 검증

---

## 6. Implementation Order

### Step 1: memory.mjs + memory/ 폴더 — 핵심 기반
1. [ ] memory/ 폴더 생성 (shared_links.md, shared_knowledge.md, shared_files.md)
2. [ ] memory.mjs: detect(), list(), search(), remove() 구현
3. [ ] chat.mjs에서 memory.detect() 호출 연동
4. [ ] 테스트: "기억해줘" → 파일 저장 확인

### Step 2: history.mjs — 운영 안정성
1. [ ] history.mjs: restoreAll() 구현
2. [ ] bot.mjs ClientReady에서 history.restoreAll() 호출
3. [ ] Rate limit 처리 (채널 간 100ms 딜레이)
4. [ ] 테스트: 봇 재시작 후 이전 대화 맥락 유지 확인

### Step 3: scheduler.mjs — 능동적 메시징
1. [ ] package.json에 node-cron 추가
2. [ ] scheduler.mjs: weeklyDigest(), meetingReminder() 구현
3. [ ] bot.mjs ClientReady에서 scheduler.start() 호출
4. [ ] 테스트: 수동 트리거로 다이제스트 발송 확인

### Step 4: admin.mjs — 관리자 도구
1. [ ] commands/admin.mjs: 슬래시 커맨드 정의
2. [ ] admin.mjs: reload(), memoryManage(), status() 구현
3. [ ] deploy-commands.mjs로 커맨드 등록
4. [ ] 테스트: /admin reload, /admin status 동작 확인

### Step 5: 통합 테스트 + 배포
1. [ ] 전체 기능 통합 테스트
2. [ ] 기존 v3 기능 호환성 확인 (멘션 응답, 웹검색, URL 읽기)
3. [ ] rsync로 원격 동기화
4. [ ] PM2 재시작 + 로그 확인

---

## 7. Risk Assessment

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| Discord API rate limit (히스토리 복원) | 중 | 낮 | 채널 간 100ms 딜레이, 실패 시 건너뛰기 |
| Cron 다이제스트가 스팸 느낌 | 중 | 중 | 주 1회 제한, 형식 간결하게 |
| memory/ 파일 무한 증가 | 낮 | 낮 | 관리자 삭제 기능 + 향후 자동 정리 |
| node-cron 타임존 이슈 | 중 | 중 | UTC 기준으로 명시 (00:00 UTC = 09:00 KST) |
| 기존 기능 호환성 깨짐 | 낮 | 높 | 비파괴적 추가만 진행, 기존 코드 최소 변경 |

---

## 8. Deferred Features (TODO)

| # | 기능 | 레슨 | 시기 | 트리거 |
|---|------|------|------|--------|
| 5 | 오류학습 (learnings.md) | #05 | v5 | 운영 중 반복 실수 발견 시 |
| 6 | 토큰 최적화 (컨텍스트 압축) | #16 | v5 | Gemini API 비용 증가 시 |
| 7 | Heartbeat 순찰 시스템 | #09 | v5 | Cron으로 부족한 감지 필요 시 |
| 8 | 보안 코드 검증 | #17 | v5 | 외부 사용자 노출 시 |
| - | Sub-agent 분리 | #15,#20 | v6+ | 봇 부하 증가 시 |
| - | memorySearch 시맨틱 검색 | #08 | v6+ | knowledge 파일 20개+ 시 |
| - | ontology 지식 그래프 | - | v6+ | 구조적 관계 관리 필요 시 |

---

## 9. Brainstorming Log

| Phase | 결정 | 근거 |
|-------|------|------|
| Phase 1 | 6개 기능 전부 구현 → 4개 DO + 4개 TODO | 사용자: "전부 다 한번에" |
| Phase 2 | 모듈형 확장 아키텍처 | 파일당 200줄 이하 유지, 기존 코드 최소 변경 |
| Phase 3 | 5-8번 기능 DEFER → TODO 관리 | YAGNI: 현재 필요한 것만 구현 |
| Phase 4.1 | bot.mjs = 오케스트레이터 패턴 | ClientReady에서 모듈 초기화 |
| Phase 4.2 | 4개 모듈 설계 확정 | history/memory/scheduler/admin 각 독립 |
| Phase 4.3 | 다이제스트 채널 ID 직접 지정 | 1484166024923316344 |

---

## 10. Technical Details

### 새 의존성
```json
{
  "node-cron": "^3.0.0"
}
```

### 파일 변경 요약

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| bot.mjs | 수정 | ClientReady에 history/scheduler/admin 초기화 추가 |
| chat.mjs | 수정 | memory.detect() 호출 + loadKnowledge() export 추가 |
| history.mjs | **신규** | 채널 히스토리 복원 |
| memory.mjs | **신규** | 기억하기 기능 (detect/list/search/remove) |
| scheduler.mjs | **신규** | Cron 주간다이제스트 + 모임리마인더 |
| admin.mjs | **신규** | 관리자 기능 로직 |
| commands/admin.mjs | **신규** | /admin 슬래시 커맨드 정의 |
| package.json | 수정 | node-cron 의존성 추가 |
| memory/*.md | **신규** | 영구 저장소 파일 3개 |

### 배포 명령어
```bash
# 로컬 → 원격 동기화
rsync -avz --exclude='node_modules' --exclude='.env' /Users/wine_ny/side-project/daolab/daolab-bot/ nurisopenclaw@100.107.90.29:/Users/nurisopenclaw/projects/daolab-bot/
rsync -avz /Users/wine_ny/side-project/daolab/knowledge/ nurisopenclaw@100.107.90.29:/Users/nurisopenclaw/projects/knowledge/

# 원격에서 의존성 설치
ssh nurisopenclaw@100.107.90.29 "export NVM_DIR=~/.nvm && source ~/.nvm/nvm.sh && cd /Users/nurisopenclaw/projects/daolab-bot && npm install"

# 슬래시 커맨드 등록 + 봇 재시작
ssh nurisopenclaw@100.107.90.29 "export NVM_DIR=~/.nvm && source ~/.nvm/nvm.sh && cd /Users/nurisopenclaw/projects/daolab-bot && node deploy-commands.mjs && pm2 restart daolab-bot"
```

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-19 | Plan Plus draft — bbojjak 19레슨 분석 + 4기능 설계 | wine_ny |
