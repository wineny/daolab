# DaoLab Project

## 프로젝트 구조

- `daolab-bot/` — DaoLab 디스코드 봇 (Discord.js v14, 슬래시 커맨드)
- `knowledge/` — 다오랩 연구 위키 (역대 연구, 추천 도서, 참고문헌)
- `docs/` — 프로젝트 문서

## 원격 PC 배포 정보

| 항목 | 값 |
|------|-----|
| 호스트 | nurisopenclaw@100.107.90.29 (Tailscale) |
| daolab-bot 경로 | `/Users/nurisopenclaw/projects/daolab-bot/` |
| 런타임 | Node.js (nvm, ESM) |
| 프로세스 관리 | PM2 (`ecosystem.config.cjs`) |
| .env 필요 | `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` |

### 원격 봇 관리 명령어

```bash
# 접속
ssh nurisopenclaw@100.107.90.29

# nvm 로드 후 실행
export NVM_DIR=~/.nvm && source ~/.nvm/nvm.sh
cd /Users/nurisopenclaw/projects/daolab-bot

# 봇 시작/재시작
node bot.mjs              # 직접 실행
pm2 start ecosystem.config.cjs  # PM2로 상시 실행
pm2 restart daolab-bot

# 슬래시 명령어 등록
node deploy-commands.mjs

# 로컬에서 원격으로 동기화
rsync -avz --exclude='node_modules' ./daolab-bot/ nurisopenclaw@100.107.90.29:/Users/nurisopenclaw/projects/daolab-bot/
```
