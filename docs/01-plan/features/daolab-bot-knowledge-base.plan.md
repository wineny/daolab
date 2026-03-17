# Plan: DaoLab 봇 지식베이스 구축

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | DaoLab 디스코드 봇 지식베이스 |
| 시작일 | 2026-03-16 |
| 예상 기간 | 1일 (구조화 + 배포) |

| 관점 | 내용 |
|------|------|
| **Problem** | 7기 신규 멤버 32명이 다오랩 조직·일정·멤버·연구주제를 빠르게 파악할 방법이 없음 |
| **Solution** | 수집된 18개 문서를 6개 주제별 지식파일로 구조화하여 OpenClaw workspace에 배치 |
| **Function UX Effect** | 디스코드에서 @봇 멘션으로 다오랩 관련 질문 시 즉시 정확한 답변 |
| **Core Value** | 온보딩 시간 단축 + 조직 지식의 체계적 보존 |

---

## 1. User Intent Discovery

### 핵심 문제
- 신규 멤버 온보딩: 7기 멤버가 다오랩을 빠르게 이해하고 적응
- 조직 지식 아카이브: 연구 결과, 발표 자료, 실험 기록의 체계적 보존 및 검색

### 대상 유저
- 7기 신규 멤버 32명 (1차 대상)

### 성공 기준
- 봇이 "다오랩이 뭐야?", "다음 모임 언제야?", "DAO가 뭐야?" 등 기본 질문에 정확히 답변
- 멤버 정보 조회 가능 ("델란은 누구야?")
- 공식 링크 안내 가능

---

## 2. Alternatives Explored

| 접근법 | 설명 | 선택 |
|--------|------|------|
| **A: Workspace 통합** | 문서를 MD로 구조화 → OpenClaw workspace 배치 | ✅ 선택 |
| B: RAG 파이프라인 | 벡터 DB + 검색 스킬 | 향후 확장 시 |
| C: 하이브리드 | 핵심은 workspace, 상세는 RAG | 향후 확장 시 |

**선택 이유**: 빠른 적용, 낮은 복잡도, 별도 인프라 불필요. OpenClaw이 세션마다 workspace 파일을 자동으로 읽으므로 즉시 효과.

---

## 3. Architecture

### 3-1. 에이전트 구조

```
OpenClaw Gateway (원격 PC 100.107.90.29)
├── main (로찌) — 텔레그램/슬랙 — GPTers 미션
├── rona (로나) — 텔레그램 — 개인 비서
└── daolab (NEW) — 디스코드 — DaoLab 7기 지원
    └── workspace: ~/.openclaw/workspace-daolab/
```

### 3-2. Workspace 구조

```
~/.openclaw/workspace-daolab/
├── SOUL.md                    ← DaoLab 봇 페르소나·성격·역할
├── AGENTS.md                  ← 지식 참조 규칙·세션 시작 절차
├── knowledge/
│   ├── 01_org_overview.md     ← 조직 개요 (~3KB)
│   ├── 02_7gi_schedule.md     ← 7기 일정 & 활동 (~2KB)
│   ├── 03_members_summary.md  ← 32명 요약 프로필 (~10KB)
│   ├── 04_research_topics.md  ← 연구 주제 요약 (~5KB)
│   ├── 05_links_directory.md  ← 공식 링크 (~2KB)
│   └── 06_faq.md              ← 예상 Q&A (~3KB)
├── MEMORY.md                  ← 장기 기억
└── memory/                    ← 일별 메모리
```

### 3-3. 지식 파일 소스 매핑

| 지식 파일 | 원본 문서 (docs/links/) | 변환 방식 |
|----------|------------------------|----------|
| 01_org_overview | 02(노션), 06(다오콘2026), 10(2026계획문서), 01(홈페이지) | 핵심 추출 + 구조화 |
| 02_7gi_schedule | 이메일 정보, 14(사전설문), 15(장소) | 일정표 형태로 정리 |
| 03_members_summary | 16(통합본 250KB), 05(자기소개 슬라이드) | 1인당 3줄 요약으로 압축 |
| 04_research_topics | 08(모두콘2024), 09(2026계획슬라이드), 17-18(강의) | 주제별 핵심 개념 정리 |
| 05_links_directory | memory/project_daolab_info.md | 카테고리별 링크 목록 |
| 06_faq | 전체 문서 기반 | 예상 질문 10-15개 + 답변 |

### 3-4. OpenClaw 설정 변경

`openclaw.json`에 추가할 내용:
```json
{
  "agents.list": [
    // ... 기존 main, rona ...
    {
      "id": "daolab",
      "name": "다오랩봇",
      "workspace": "/Users/nurisopenclaw/.openclaw/workspace-daolab",
      "model": { "primary": "anthropic/claude-sonnet-4-6" },
      "identity": { "name": "다오랩봇", "emoji": "🏛️" },
      "groupChat": {
        "mentionPatterns": ["다오랩봇", "daolab"],
        "historyLimit": 50
      }
    }
  ],
  "bindings": [
    // ... 기존 ...
    {
      "agentId": "daolab",
      "match": { "channel": "discord", "accountId": "default" }
    }
  ]
}
```

---

## 4. YAGNI Review

### ✅ 포함 (v1)
- DaoLab 페르소나 (SOUL.md)
- 조직 개요 지식파일
- 멤버 프로필 요약
- 연구 주제 지식파일
- 링크 디렉토리
- FAQ

### ⏭️ 추후 (v2+)
- RAG 기반 상세 검색
- 멤버 간 매칭/추천
- 일정 리마인더 자동화
- 조별 연구 진행 추적
- 투표/설문 기능

---

## 5. Implementation Steps

### Step 1: 지식 파일 생성 (6개)
- 원본 18개 문서에서 핵심 추출
- 주제별로 구조화하여 MD 파일 생성
- 토큰 예산 내로 압축 (총 ~25KB 목표)

### Step 2: Workspace 파일 생성
- SOUL.md: DaoLab 페르소나 정의
- AGENTS.md: 지식 참조 규칙

### Step 3: 원격 PC에 배포
- SSH로 workspace-daolab/ 디렉토리 생성
- 파일 전송

### Step 4: OpenClaw 에이전트 등록
- openclaw.json에 daolab 에이전트 추가
- 디스코드 바인딩 설정
- 게이트웨이 재시작

### Step 5: 테스트
- 디스코드 DM으로 기본 질문 테스트
- 답변 품질 확인 및 지식 파일 조정

---

## 6. Brainstorming Log

| Phase | 결정 | 이유 |
|-------|------|------|
| Intent | 온보딩 + 아카이브 | 7기 시작 시점에 가장 필요 |
| Target | 7기 신규 멤버 | 32명이 즉시 활용 가능 |
| Approach | Workspace 통합 (A) | 빠른 적용, 인프라 불필요 |
| Agent | 별도 에이전트 분리 | 기존 로찌/로나에 영향 없음 |
| Files | 6개 주제별 파일 | 전체 선택 — 모두 필수 |

---

## 7. Risks & Mitigations

| 리스크 | 대응 |
|--------|------|
| 지식 파일 총량이 토큰 제한 초과 | 25KB 이내로 압축, 핵심만 포함 |
| 멤버 프로필 250KB → 요약 시 정보 손실 | 1인당 핵심 3줄 + 상세는 원본 링크 안내 |
| 봇이 틀린 정보를 답변 | FAQ에 정확한 답변 미리 작성, SOUL.md에 "모르면 모른다고 하라" 명시 |
| 디스코드 채널 권한 미확보 | 관리자에게 초대 URL 전달 완료 대기 |
