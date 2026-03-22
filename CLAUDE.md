# DaoLab Project

## 프로젝트 구조

- `daolab-bot/` — (레거시) DaoLab 디스코드 봇 코드. 현재 PM2 중지됨, OpenClaw으로 대체
- `knowledge/` — 다오랩 연구 위키 (역대 연구, 추천 도서, 참고문헌)
- `docs/` — 프로젝트 문서

## 원격 PC 정보

| 항목 | 값 |
|------|-----|
| 호스트 | `nurisopenclaw@100.107.90.29` (Tailscale) |
| SSH | `ssh nurisopenclaw@100.107.90.29` |
| Node.js | v24.13.1 (nvm) |
| nvm 로드 | `export NVM_DIR=~/.nvm && source ~/.nvm/nvm.sh` |

## OpenClaw (봇 운영 플랫폼)

3개 봇이 하나의 OpenClaw Gateway에서 운영됨:

| 봇 | 에이전트 ID | 채널 | 모델 |
|----|-----------|------|------|
| 🥑 클로찌 | `main` | Telegram @clawzzi_bot | Claude Opus |
| 🌸 로나 | `rona` | Telegram @clawrona_bot | Claude Opus |
| 🏛️ 다오랑 | `daolab` | Discord @다오랑 | Claude Opus |

### 핵심 경로

| 경로 | 용도 |
|------|------|
| `/Users/nurisopenclaw/.openclaw/openclaw.json` | 전체 설정 (에이전트, 채널, 토큰) |
| `/Users/nurisopenclaw/.openclaw/workspace/` | 클로찌 workspace |
| `/Users/nurisopenclaw/.openclaw/workspace-rona/` | 로나 workspace |
| `/Users/nurisopenclaw/.openclaw/workspace-daolab/` | 다오랑 workspace |
| `/Users/nurisopenclaw/Library/pnpm/openclaw` | OpenClaw CLI 바이너리 |

### 다오랑 workspace 구조

```
workspace-daolab/
├── SOUL.md              # 성격, 말투(해요체), 답변 규칙
├── IDENTITY.md          # 이름, 이모지, 정체성
├── AGENTS.md            # 지식 참조 매핑
├── USER.md              # 대상 사용자 정보
├── HEARTBEAT.md         # 주기 체크리스트
├── TOOLS.md             # 환경 설정
├── MEMORY.md            # 메모리 인덱스
├── knowledge/           # 다오랩 지식 8개 파일
│   ├── 01~07_*.md       # 조직, 일정, 멤버, 연구 등
│   ├── 08_crew_intro.md # 크루 요약 (20KB)
│   └── .archive/08_crew_intro_full.md  # 상세 원본 (244KB)
├── memory/              # 멤버 공유 정보 (links, knowledge, files)
└── .learnings/          # 에러 학습, 기능 요청
```

### 원격 명령어

```bash
# SSH 내에서 nvm 로드 필수
ssh nurisopenclaw@100.107.90.29
export NVM_DIR=~/.nvm && source ~/.nvm/nvm.sh

# OpenClaw CLI (전체 경로 필요)
/Users/nurisopenclaw/Library/pnpm/openclaw health        # 봇 상태 확인
/Users/nurisopenclaw/Library/pnpm/openclaw gateway restart  # Gateway 재시작
/Users/nurisopenclaw/Library/pnpm/openclaw agent --agent daolab -m "메시지"  # 다오랑 테스트
/Users/nurisopenclaw/Library/pnpm/openclaw logs           # 로그 확인
/Users/nurisopenclaw/Library/pnpm/openclaw update         # 업데이트

# 로컬 맥에서 바로 실행 (alias 설정됨)
oc health
oc agent --agent daolab -m "테스트"
```

### 주의사항

- OpenClaw은 **pnpm 글로벌 설치본**을 사용해야 함. 소스 빌드(`/Users/nurisopenclaw/openclaw-nuri/`)로 Gateway를 실행하면 토큰 불일치 발생
- 봇 성격/기능 변경은 workspace MD 파일만 수정하면 됨 (코드 수정 불필요)
- MD 파일 수정 후 `gateway restart`해야 반영됨
- PM2 daolab-bot은 중지됨 (같은 Discord 토큰 충돌 방지)
