# DaoLab 봇 v3 — Plan Plus (Brainstorming-Enhanced)

> **Feature**: daolab-bot-v3
> **Date**: 2026-03-17
> **Author**: wine_ny
> **Method**: Plan Plus (Intent Discovery + Alternatives + YAGNI Review)
> **Research**: 3 parallel agents (Web Research + Community Analysis + Remote Server Exploration)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | DaoLab 봇 v3 — OpenClaw 고급 기능 활용 고도화 |
| 시작일 | 2026-03-17 |
| 예상 기간 | 2-3일 |

| 관점 | 내용 |
|------|------|
| **Problem** | 47%의 멤버가 최소 참여(주 5-10시간), 정보 분산(Discord/Notion/Docs/YouTube), 연구 협업 코디네이션 부재, 봇이 반응형(reactive)에 그침 |
| **Solution** | OpenClaw Heartbeat(능동적 메시징) + Sub-agent(전문 분야별 에이전트) + 의미 검색(memorySearch) + 일정 연동 활용 |
| **Function UX Effect** | 봇이 먼저 주간 요약을 보내고, 일정을 알려주고, 연구 관련 멤버를 능동적으로 연결하며, 자연어로 지식 검색 가능 |
| **Core Value** | 시간 부족 멤버의 참여 장벽 극적 감소 + 32명의 다학제적 전문성이 자연스럽게 연결되는 "살아있는 커뮤니티 봇" |

---

## Phase 1: Intent Discovery

### 1.1 핵심 질문: "왜 v3가 필요한가?"

v2는 **반응형(reactive)** 봇 — 멤버가 물어봐야 답한다.
v3는 **능동형(proactive)** 봇으로 전환 — 봇이 먼저 가치를 제공한다.

### 1.2 사용자 의도 분석

| 의도 | 현재 상태 | v3 목표 |
|------|----------|---------|
| "이번 주 뭐 있지?" | 직접 물어봐야 답변 | 봇이 매주 월요일 DM으로 주간 요약 전송 |
| "나랑 비슷한 연구하는 사람?" | @멘션 + 키워드 검색 | 봇이 연구 주제 겹치는 멤버를 능동적으로 소개 |
| "지난주 공유된 자료 뭐였지?" | 기억나? 명령어 필요 | 자연어 의미 검색으로 관련 지식 자동 추천 |
| "내일 모임 몇 시야?" | 수동 확인 | 모임 전날 자동 리마인더 |

### 1.3 다오랩 커뮤니티 특성 기반 니즈

**3개 에이전트 리서치 종합 결과:**

#### 참여 불균형 (가장 큰 Pain Point)
```
주 20시간+:  3명 (9%)  — 수찬, 진저, 엘리오
주 10시간+: 14명 (44%) — 다양한 역할
주 5-10시간: 11명 (34%) — 대기업 리더, 프리랜서
주 5시간:    4명 (13%) — CEO, 교수 (고가치 but 시간 부족)
```
→ **47% 멤버가 최소 참여** → 봇이 "5분 안에 이번 주 파악" 기능 필수

#### 다학제적 멤버 구성 (미활용 기회)
- #AI: 18명(56%) — 압도적 공통 관심사
- #커뮤니티: 12+명
- #자율조직: 11+명
- 법률, 예술, 헬스케어, 대기업, 사회복지... 자연스럽게 만날 기회 부족

#### 14주 프로그램 라이프사이클
- 1-2주: 온보딩 → 3-4주: 연구팀 구성 → 5-10주: 연구 → 11-14주: 발표 준비
- 각 단계별 봇 역할이 달라져야 함

---

## Phase 2: OpenClaw 미활용 기능 탐색

### 2.1 원격 서버 스킬 현황 (실제 조사)

**현재 다오랩봇에 없는 사용 가능 스킬:**

| 스킬 | 상태 | 설명 | DaoLab 활용 가능성 |
|------|------|------|-------------------|
| **Heartbeat** | 미설정 | 주기적 능동 메시징 | ★★★★★ 주간 다이제스트 |
| **Sub-agents** | 미사용 | 하위 에이전트 분리 | ★★★★ 연구/매칭/일정 전문화 |
| **memorySearch** | 미활성 | 시맨틱 벡터 검색 | ★★★★ 지식 자연어 검색 |
| **calendar** | 번들(미설치) | Google Calendar 연동 | ★★★★ 일정 관리 자동화 |
| **ontology** | 설치됨 | 타입드 지식 그래프 | ★★★★ 멤버-연구-자원 관계망 |
| **proactive-agent** | 설치됨 | WAL Protocol + Cron | ★★★★ 자율 행동 패턴 |
| **AI Trend Monitor** | 설치됨 | AI 트렌드 모니터링 | ★★★ AI 연구 그룹 뉴스 피드 |
| **rss** | 번들(미설치) | RSS 구독 | ★★★ 관련 블로그/뉴스 수집 |
| **tavily** | 설치됨 | AI 최적화 웹 검색 | ★★★ 실시간 정보 검색 |
| **loopwind** | 설치됨 | React→이미지/영상 생성 | ★★ 발표 자료 생성 |
| **image-gen** | 번들(미설치) | 이미지 생성 | ★★ 시각 자료 |
| **slack** | 번들(미설치) | Slack 연동 | ★ (DaoLab은 Discord 중심) |
| **voice-call** | 번들(미설치) | 음성 통화 | ★ (실험적) |

### 2.2 OpenClaw 핵심 미활용 기능 상세

#### A. Heartbeat (능동적 메시징)
```json
// 현재: 다오랩봇에 heartbeat 미설정
// main(로찌): every: "1h"
// rona(로나): every: "2h", activeHours: 08:00-23:00

// 제안: 다오랩봇에 추가
"heartbeat": {
  "every": "24h",
  "activeHours": {
    "start": "09:00",
    "end": "22:00",
    "timezone": "Asia/Seoul"
  }
}
```
Heartbeat이 작동하면 봇이 주기적으로 "깨어나서" 할 일을 확인하고 능동적으로 행동 가능.

#### B. Sub-agents (전문 에이전트)
```json
// 현재: maxConcurrent: 8 (서버 설정), 다오랩봇 미사용
"subagents": {
  "maxConcurrent": 8,
  "model": "anthropic/claude-haiku-4-5-20251001",
  "thinking": "low"
}
```
가벼운 하위 에이전트(haiku)를 spawn해서 병렬 처리 가능. 예: 32명 멤버 프로필 동시 검색.

#### C. memorySearch (시맨틱 검색)
- SQLite 벡터 DB (`~/.openclaw/memory/{agentId}.sqlite`)
- 마크다운 파일 자동 인덱싱 + 임베딩
- 자연어 질문 → 의미 기반 검색 (키워드 매칭이 아닌 문맥 이해)

#### D. Knowledge Skill (RAG)
- PDF/문서 인제스션 → 청크 분할 → 벡터 인덱싱
- knowledge/ 폴더 자동 인덱싱 가능
- DaoLab 연구 자료를 직접 검색 가능하게

---

## Phase 3: Alternatives Exploration

### 3.1 세 가지 구현 방향

#### Option A: "주간 다이제스트 봇" (최소 변경)
- Heartbeat 설정 + SOUL.md에 주간 요약 규칙 추가
- 매주 월요일 아침, 멤버별 관심사 기반 개인화 DM 전송
- **난이도**: 낮음 (설정 변경 + 규칙 추가)
- **임팩트**: 높음 (47% 저참여 멤버 직접 혜택)

#### Option B: "지능형 커뮤니티 어시스턴트" (중간 수준)
- Option A + memorySearch + 일정 인지 + 연구 코디네이터
- 자연어 검색, 일정 리마인더, 연구 그룹 매칭
- **난이도**: 중간 (스킬 설치 + 설정 + 규칙)
- **임팩트**: 매우 높음

#### Option C: "자율 조직 실험 봇" (풀 스펙)
- Option B + Sub-agents + ontology 지식 그래프 + 기여 가시화
- 봇 자체가 DAO 원칙을 체현하는 실험
- **난이도**: 높음 (아키텍처 변경 필요)
- **임팩트**: 전략적 (다오랩의 연구 주제와 직결)

### 3.2 추천: Option B (지능형 커뮤니티 어시스턴트)

**이유:**
1. Option A는 임팩트 대비 너무 단순 — 금방 구현되지만 확장성 부족
2. Option C는 14주 프로그램 기간 내 완성이 어려움
3. Option B는 2-3일 구현 + 즉시 커뮤니티 가치 제공 + 향후 C로 확장 가능

---

## Phase 4: YAGNI Review

### 4.1 "지금 정말 필요한가?" 필터

| 기능 | 필요성 | 판정 | 이유 |
|------|--------|------|------|
| Heartbeat 주간 다이제스트 | 47% 저참여 멤버 | ✅ DO | 가장 높은 ROI |
| 일정 리마인더 | 14주 프로그램 운영 | ✅ DO | 운영 부담 감소 |
| memorySearch 의미 검색 | 지식 축적 후 검색 | ✅ DO | v2 지식 수집과 시너지 |
| 연구 그룹 매칭 | 3-4주차 팀 구성 시 | ✅ DO | 시기적으로 적합 |
| Sub-agent 분리 | 현재 단일 에이전트 | ⏭️ DEFER | 아직 복잡도 불필요 |
| ontology 지식 그래프 | 구조적 데이터 관리 | ⏭️ DEFER | 멤버 수 32명에 과잉 |
| 음성/비디오 기능 | 텍스트로 충분 | ❌ SKIP | 복잡도 대비 가치 낮음 |
| AI Trend Monitor | 뉴스 피드 | ⏭️ DEFER | 멤버 직접 공유가 더 유기적 |
| 기여 가시화 대시보드 | 게이미피케이션 위험 | ❌ SKIP | 다오랩 철학과 충돌 가능 |
| 이미지/영상 생성 | 발표 자료 | ⏭️ DEFER | 11-14주차에 고려 |

---

## Phase 5: Feature Specification (v3)

### Feature 1: Heartbeat 주간 다이제스트 ★★★★★

**개요**: 매주 월요일 오전, 멤버에게 개인화된 주간 요약 DM 전송

**구현 방식**:
1. `openclaw.json`에 daolab 에이전트 heartbeat 설정 추가
2. `SOUL.md`에 주간 다이제스트 생성 규칙 추가
3. Heartbeat 발동 시 → memory/ + knowledge/ 확인 → 개인화 요약 생성

**다이제스트 내용**:
- 이번 주 일정 (02_7gi_schedule.md 기반)
- 최근 수집된 지식/링크 요약 (memory/ 기반)
- 멤버의 키워드 태그와 관련된 최근 활동 하이라이트
- "이번 주 주목할 멤버" (관심사 겹치는 멤버 1-2명 소개)

**예시 출력**:
```
🏛️ 다오랩 주간 다이제스트 (3/17 ~ 3/23)

📅 이번 주 일정
- 3/18(화) 19:00 정기모임 @ 강남캠퍼스
  주제: 연구 주제 확정 + 팀 구성

📝 최근 공유된 지식 (2건)
- 오프라인 모임 3/22 토요일 강남역 스타벅스
- 다오랩 블로그 공유됨

🔍 [당신의 관심사: #AI #거버넌스] 관련
- 에린(김혜진)이 AI+거버넌스 관련 자료를 공유할 예정이에요
- 제이(강정욱)도 비슷한 주제를 연구 중!

더 자세히 알고 싶으면 언제든 물어봐! 😊
```

**설정 변경 (openclaw.json)**:
```json
{
  "id": "daolab",
  "heartbeat": {
    "every": "168h",
    "activeHours": {
      "start": "09:00",
      "end": "10:00",
      "timezone": "Asia/Seoul"
    }
  }
}
```

### Feature 2: 일정 인지 + 자동 리마인더 ★★★★

**개요**: 봇이 현재 날짜를 인지하고, 일정 기반 능동적 안내

**구현 방식**:
1. `SOUL.md`에 일정 인지 규칙 추가
2. Heartbeat 활용하여 모임 전날 리마인더
3. "이번 주 뭐 있어?" → 현재 날짜 기준 응답

**SOUL.md 추가 규칙**:
```markdown
## 일정 인지 규칙
1. 현재 날짜를 항상 인지하고, 02_7gi_schedule.md를 참고
2. "이번 주", "다음 주", "내일" 등 상대 시간 질문에 정확히 답변
3. Heartbeat 시: 다음 모임이 24시간 이내면 리마인더 생성
4. 14주 프로그램의 현재 주차를 인지 (3/4 시작 → 현재 2주차)
5. 주차별 맞춤 안내:
   - 1-2주차: 온보딩 퀘스트 안내
   - 3-4주차: 연구 주제 선정/팀 구성 안내
   - 5-10주차: 연구 진행 체크인
   - 11-14주차: 발표 준비 안내
```

### Feature 3: memorySearch 시맨틱 검색 ★★★★

**개요**: 키워드가 아닌 자연어 의미 기반으로 knowledge/ + memory/ 검색

**구현 방식**:
1. OpenClaw memorySearch 활성화 (knowledge/ 폴더 인덱싱)
2. memory/ 폴더도 인덱싱 대상에 포함
3. 자연어 질문 → 벡터 유사도 기반 관련 정보 검색

**활용 시나리오**:
```
사용자: "@다오랩 거버넌스 실패 사례 관련 자료 있어?"
봇: (memorySearch로 knowledge/ 전체를 의미 검색)
    "🔍 거버넌스 실패 관련으로 찾았어!
    📄 04_research_topics.md에서:
    - 연구문제 9: '실패의 정치학과 구조적 학습'
    - 관련 분야: 조직심리학, 커뮤니티 연구
    👤 관련 멤버: 비버(거버넌스/규칙 설계), 방자(커뮤니티 규범)
    더 알고 싶으면 물어봐!"
```

### Feature 4: 연구 그룹 매칭 어시스턴트 ★★★

**개요**: 9개 연구 문제 × 32명 멤버의 최적 매칭

**구현 방식**:
1. `SOUL.md`에 연구 매칭 규칙 추가
2. 04_research_topics.md의 9개 연구 문제를 참조
3. 멤버의 키워드 태그 + 관심 주제 + 전문 분야로 추천

**활용 시나리오**:
```
사용자: "@다오랩 동기 설계 연구에 적합한 멤버 추천해줘"
봇: "🔬 '동기 설계 / 인센티브 구조' 연구에 추천하는 멤버야!

    핵심 멤버:
    - 진저(홍지연): 마케터, 자율조직 기여 동기/인센티브 구조 전문
    - 커비(김은지): CSR, 기여 기반 동기 설계 연구
    - 긍쩡아(박정아): 사회복지, 자율성/참여동기 극대화 연구

    시너지 멤버:
    - 유주(이혜림): 청년커뮤니티, 동기부여 구조 연구
    - 채드(유종현): 애자일 코치, 자율 조직과 개인 성향 연구

    다학제 관점 추가:
    - 나무(김예정): 상담심리 박사, 심리적 안전감/소프트스킬

    6명이면 좋은 팀이 될 것 같아! 😊"
```

---

## Implementation Order

### Step 0: Quick Wins (즉시 적용) — 30분
1. [ ] IDENTITY.md 채우기 (다오랩봇 이름/이모지/바이브)
2. [ ] `.learnings/` 디렉토리 + ERRORS.md, LEARNINGS.md, FEATURE_REQUESTS.md 생성
3. [ ] Discord 스트리밍 `off` → `partial` 변경 (openclaw.json)
4. [ ] USER.md 채우기 (다오랩 7기 멤버 대상 안내 봇)
5. [ ] `openclaw gateway restart`

### Step 1: Heartbeat + Cron 설정 (openclaw.json) — 30분
1. [ ] daolab 에이전트에 heartbeat 설정 추가
2. [ ] HEARTBEAT.md에 주간 체크리스트 작성
3. [ ] Cron job 2개 추가 (화요일 이벤트 리마인더 + 월요일 주간 다이제스트)
4. [ ] `openclaw gateway restart`
5. [ ] heartbeat + cron 발동 테스트

### Step 2: SOUL.md 규칙 추가 — 1시간
1. [ ] 주간 다이제스트 생성 규칙 추가
2. [ ] 일정 인지 규칙 추가
3. [ ] 연구 그룹 매칭 규칙 추가
4. [ ] 프로그램 주차 인지 규칙 추가

### Step 3: AGENTS.md 업데이트 — 30분
1. [ ] Heartbeat 발동 시 참조 파일 매핑 추가
2. [ ] 일정 질문 유형 확장
3. [ ] 연구 매칭 질문 유형 추가

### Step 4: memorySearch 활성화 — 1시간
1. [ ] knowledge/ 폴더 인덱싱 설정
2. [ ] memory/ 폴더 인덱싱 설정
3. [ ] 시맨틱 검색 테스트

### Step 5: 통합 테스트 — 1시간
1. [ ] Heartbeat 주간 다이제스트 발동 테스트
2. [ ] 일정 인지 질문 테스트
3. [ ] 시맨틱 검색 질문 테스트
4. [ ] 연구 그룹 매칭 테스트
5. [ ] 기존 v2 기능 호환성 확인

---

## Deferred Features (v4+)

| Feature | 우선순위 | 시기 | 이유 |
|---------|---------|------|------|
| Sub-agent 분리 | P2 | v4 | 봇 부하 증가 시 |
| ontology 지식 그래프 | P2 | v4 | 구조적 관계 관리 필요 시 |
| AI Trend Monitor 연동 | P3 | 5-10주차 | 연구 단계 진입 후 |
| loopwind 발표자료 생성 | P3 | 11-14주차 | 발표 준비 단계 |
| proactive-agent 자율 행동 | P2 | v4 | 패턴 데이터 축적 후 |
| RSS 뉴스 수집 | P3 | 유연 | 멤버 요청 시 |

---

## Phase 6: 원격 서버 탐색 결과 — Quick Wins 발견

### 6.1 다오랩봇 미활용 현황 (심각)

3번째 에이전트가 원격 서버를 SSH로 탐색한 결과, **다오랩봇이 OpenClaw 기능의 10% 미만을 활용** 중임이 밝혀짐.

| 항목 | rozzi (메인봇) | rona | daolab | 격차 |
|------|--------------|------|--------|------|
| Cron Jobs | 5개 | 2개 | **0개** | ❌ 완전 미설정 |
| 시맨틱 메모리 (SQLite) | 10MB | 6.4MB | **없음** | ❌ 인덱스 없음 |
| .learnings/ 디렉토리 | ✅ | ✅ | **없음** | ❌ 자기개선 불가 |
| IDENTITY.md | 채워짐 | 채워짐 | **빈 템플릿** | ⚠️ |
| USER.md | 채워짐 | 채워짐 | **빈 템플릿** | ⚠️ |
| HEARTBEAT.md | 체크리스트 | 체크리스트 | **빈 파일** | ❌ |
| 워크스페이스 스킬 | 14+개 | 3개 | **0개** | ❌ |
| Discord 스트리밍 | N/A | N/A | **off** | ⚠️ partial 권장 |
| 모델 | opus | opus | **sonnet** | 의도적 (비용) |

### 6.2 Quick Wins (즉시 적용, 구현 0분~30분)

이미 인프라가 갖춰져 있어 설정만 바꾸면 되는 항목들:

| # | Quick Win | 구현 시간 | 임팩트 |
|---|-----------|----------|--------|
| QW1 | IDENTITY.md 채우기 (이름/이모지/바이브) | 5분 | 봇 페르소나 일관성 |
| QW2 | .learnings/ 디렉토리 생성 (ERRORS.md, LEARNINGS.md) | 5분 | 자기개선 루프 활성화 |
| QW3 | Discord 스트리밍 `off` → `partial` | 1분 | 응답 UX 개선 |
| QW4 | HEARTBEAT.md에 체크리스트 추가 | 10분 | 능동적 모니터링 시작 |
| QW5 | Cron: 이벤트 리마인더 (매일 9AM 확인) | 10분 | 일정 알림 자동화 |
| QW6 | Cron: 주간 라운드업 (월 9:30 AM) | 10분 | 주간 요약 자동 전송 |

### 6.3 Cron Jobs 설계 (rozzi 참고)

rozzi의 기존 cron 패턴을 다오랩에 맞춰 적용:

```
// rozzi 기존 패턴
Morning Briefing:  0 9 * * 1-5  (평일 9AM)
Daily Wrap-up:     0 18 * * 1-5 (평일 6PM)
Weekly Report:     30 9 * * 1   (월요일 9:30AM)
Dawn Patrol:       0 1 * * *    (매일 1AM)

// 다오랩봇 제안
Event Reminder:    0 9 * * 2    (화요일 9AM — 정기모임 당일)
Weekly Digest:     0 9 * * 1    (월요일 9AM — 주간 시작)
Knowledge Refresh: 0 1 * * *    (매일 1AM — memory/ 인덱싱)
```

### 6.4 발견된 추가 기회

| 기능 | 설명 | 우선순위 |
|------|------|---------|
| **Webhook 수신** | `hooks.allowedAgentIds`에 이미 "daolab" 포함! 외부 이벤트 수신 가능 | P2 |
| **Subagent 위임** | daolab → haiku로 가벼운 검색 위임 가능 | P2 |
| **Discord Interactive Components v2** | 버튼, 셀렉트 메뉴, 모달 폼 → 연구 투표, 일정 확인 등 | P2 |
| **Gog (Google Workspace) 스킬** | Gmail, Calendar, Drive 연동 — 14K 다운로드 인기 스킬 | P3 |
| **API Gateway (Maton)** | 이미 API 키 설정됨! 100+ OAuth 서비스 연동 가능 | P3 |

---

## Risk Assessment

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| Heartbeat가 스팸처럼 느껴짐 | 중 | 중 | 주 1회로 제한, 개인화 필수 |
| memorySearch 인덱싱 성능 | 낮 | 낮 | 파일 6개 수준으로 가벼움 |
| 일정 데이터 오류 | 중 | 중 | schedule 파일 최신 유지 필요 |
| 기존 v2 기능 호환성 | 낮 | 높 | 비파괴적 추가만 진행 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-17 | Initial Plan Plus draft (3-agent parallel research) | wine_ny |
| 0.2 | 2026-03-17 | Remote server exploration results added — Quick Wins, Cron, gaps identified | wine_ny |
