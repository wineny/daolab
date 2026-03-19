# DaoLab 봇 v4 — 상세 설계 (Design)

> **Feature**: daolab-bot-smart
> **Date**: 2026-03-19
> **Plan Reference**: docs/01-plan/features/daolab-bot-smart.plan.md

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | DaoLab 봇 v4 — 4대 핵심 모듈 상세 설계 |
| 신규 파일 | 5개 (history.mjs, memory.mjs, scheduler.mjs, admin.mjs, commands/admin.mjs) |
| 수정 파일 | 3개 (bot.mjs, chat.mjs, package.json) |
| 신규 의존성 | node-cron ^3.0.0 |

| 관점 | 내용 |
|------|------|
| **Problem** | PM2 재시작 시 맥락 소실, 기억하기 미구현, 능동적 메시징 부재, 관리자 도구 없음 |
| **Solution** | 모듈형 확장 (기존 3파일 + 신규 5파일), 비파괴적 추가 |
| **Function UX Effect** | 재시작 후 대화 연속, "기억해줘" 실제 작동, 주간요약 자동 발송, /admin으로 봇 제어 |
| **Core Value** | 반응형 도구 → 능동적 커뮤니티 동료 |

---

## 1. Architecture Overview

```
daolab-bot/
├─ bot.mjs              # 오케스트레이터 (수정: 모듈 초기화 추가)
├─ chat.mjs             # Gemini AI 대화 (수정: memory 연동 + export 추가)
├─ tools.mjs            # 웹검색/URL (변경 없음)
├─ history.mjs          # ✨ 신규: 채널 히스토리 복원
├─ memory.mjs           # ✨ 신규: 기억하기 (파일 R/W)
├─ scheduler.mjs        # ✨ 신규: Cron 스케줄러
├─ admin.mjs            # ✨ 신규: 관리자 기능 로직
├─ deploy-commands.mjs  # 슬래시 커맨드 배포 (변경 없음)
├─ commands/
│   ├─ ping.mjs         # (변경 없음)
│   ├─ hello.mjs        # (변경 없음)
│   ├─ info.mjs         # (변경 없음)
│   └─ admin.mjs        # ✨ 신규: /admin 슬래시 커맨드
├─ memory/              # ✨ 신규: 영구 저장소
│   ├─ shared_links.md
│   ├─ shared_knowledge.md
│   └─ shared_files.md
└─ package.json         # (수정: node-cron 추가)
```

### 데이터 흐름도

```
[Discord 서버]
     │
     ▼
bot.mjs (이벤트 허브)
     │
     ├─ ClientReady ──────────────────────────────┐
     │   ├→ history.restoreAll(client)            │
     │   │     → Discord API fetch → addContext() │
     │   ├→ scheduler.start(client)               │
     │   │     → node-cron 등록                    │
     │   └→ console.log("Ready!")                 │
     │                                             │
     ├─ MessageCreate ────────────────────────┐    │
     │   ├→ addContext(channelId, name, text) │    │
     │   │     (chat.mjs - 기존)              │    │
     │   ├→ memory.detect(message)            │    │
     │   │     → true: 파일 저장 + 응답       │    │
     │   │     → false: 계속                  │    │
     │   └→ 봇 멘션/이름 호출 시              │    │
     │       → chat() → Gemini API            │    │
     │                                         │    │
     └─ InteractionCreate ────────────────┐   │    │
         ├→ /ping, /hello, /info (기존)   │   │    │
         └→ /admin (신규)                 │   │    │
             → admin.mjs 로직             │   │    │
                                           │   │    │
scheduler.mjs (독립 Cron) ◄────────────────┘   │    │
     ├→ 월 00:00 UTC (09:00 KST)              │    │
     │     → weeklyDigest() → 채널 포스팅      │    │
     └→ 화 00:00 UTC (09:00 KST)              │    │
           → meetingReminder() → 채널 포스팅    │    │
```

---

## 2. Module Design: history.mjs

### 2.1 목적
PM2 재시작 시 Discord API로 채널별 최근 메시지를 가져와 chat.mjs의 히스토리에 복원

### 2.2 API

```javascript
/**
 * 봇이 접속한 모든 길드의 텍스트 채널에서 최근 메시지를 복원
 * @param {Client} client - Discord.js Client
 * @param {Function} addContextFn - chat.mjs의 addContext 함수
 * @param {number} limit - 채널당 가져올 메시지 수 (기본: 20)
 */
export async function restoreAll(client, addContextFn, limit = 20)
```

### 2.3 구현 상세

```
restoreAll(client, addContextFn, limit):
  restoredCount = 0

  for guild of client.guilds.cache.values():
    for channel of guild.channels.cache.values():
      // 텍스트 채널만 (type === 0)
      if channel.type !== 0: continue

      try:
        messages = await channel.messages.fetch({ limit })
        // Discord는 최신순 반환 → 시간순 정렬 (오래된 것 먼저)
        sorted = [...messages.values()].reverse()

        for msg of sorted:
          if msg.author.bot && msg.author.id === client.user.id:
            // 봇 자신의 메시지 → role: "model"로 처리할 수 없으므로 건너뛰기
            // (addContext는 "user" role만 지원)
            continue

          displayName = msg.member?.displayName || msg.author.displayName
          addContextFn(channel.id, displayName, msg.content)
          restoredCount++

        // Rate limit 방지: 채널 간 100ms 대기
        await sleep(100)

      catch err:
        // 권한 없는 채널 등 → 조용히 건너뛰기
        console.warn(`[history] Skip ${channel.name}: ${err.message}`)

  console.log(`[history] Restored ${restoredCount} messages`)
  return restoredCount
```

### 2.4 주의사항
- `ChannelType.GuildText` (0) 만 대상. 보이스/스레드/포럼 채널 제외
- 봇 자신의 메시지는 건너뛰기 (addContext는 user role만 사용)
- `channel.messages.fetch()` 실패 시 (권한 부족 등) 해당 채널만 건너뛰고 계속 진행
- 채널 간 100ms 딜레이로 rate limit 방지
- `sleep` 헬퍼: `const sleep = ms => new Promise(r => setTimeout(r, ms))`

---

## 3. Module Design: memory.mjs

### 3.1 목적
SOUL.md에 정의된 "기억하기" 규칙을 실제 파일 I/O로 구현

### 3.2 API

```javascript
/**
 * 메시지에서 "기억해줘" 패턴을 감지하고 파일에 저장
 * @returns {{ detected: boolean, response: string | null }}
 */
export function detect(message)

/**
 * memory/ 파일 목록 조회 (카테고리별 또는 전체)
 * @returns {string} 포맷된 기억 목록
 */
export function list(category = null)

/**
 * memory/ 파일에서 키워드 검색
 * @returns {string} 검색 결과
 */
export function search(keyword)

/**
 * memory/ 파일에서 특정 항목 삭제 (관리자만)
 * @returns {{ success: boolean, message: string }}
 */
export function remove(keyword, userId)

/**
 * memory/ 폴더의 전체 내용을 텍스트로 반환 (시스템 프롬프트용)
 * @returns {string}
 */
export function loadMemoryContext()
```

### 3.3 구현 상세

#### detect(message)
```
SAVE_PATTERNS = [/기억해줘/, /이거 기억해/, /저장해줘/, /기억해 줘/, /저장해 줘/]
SENSITIVE_PATTERNS = [/\d{3}-\d{4}-\d{4}/, /비밀번호/, /비번/, /패스워드/]

function detect(message):
  text = message.content

  // 패턴 매칭
  if !SAVE_PATTERNS.some(p => p.test(text)):
    return { detected: false, response: null }

  // 민감정보 차단
  if SENSITIVE_PATTERNS.some(p => p.test(text)):
    return { detected: true, response: "그건 민감한 정보라 저장하지 않는 게 좋겠어!" }

  // 내용 추출 (패턴 키워드 제거)
  content = text.replace(SAVE_PATTERNS[매칭], "").trim()
  displayName = message.member?.displayName || message.author.displayName
  date = new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
  entry = `- [${date}] @${displayName}: ${content}`

  // 카테고리 분류
  urls = content.match(/https?:\/\/[^\s]+/g)
  if urls:
    targetFile = "shared_links.md"
  else:
    targetFile = "shared_knowledge.md"

  // 파일에 append
  filePath = resolve(MEMORY_DIR, targetFile)
  appendFileSync(filePath, entry + "\n", "utf8")

  // 요약 생성
  summary = content.length > 50 ? content.slice(0, 50) + "..." : content
  return { detected: true, response: `기억했어! ✅ ${summary}` }
```

#### list(category)
```
function list(category = null):
  files = category
    ? [categoryToFile(category)]
    : ["shared_links.md", "shared_knowledge.md", "shared_files.md"]

  result = []
  for file of files:
    content = readFileSync(resolve(MEMORY_DIR, file), "utf8")
    lines = content.split("\n").filter(l => l.startsWith("- ["))
    if lines.length === 0: continue

    // 최근 5개
    recent = lines.slice(-5)
    header = file.replace(".md", "").replace("shared_", "")
    result.push(`📂 ${header} (${lines.length}건, 최근 5개)`)
    result.push(...recent)

  return result.join("\n") || "아직 저장된 기억이 없어!"
```

#### search(keyword)
```
function search(keyword):
  allEntries = []
  for file of ["shared_links.md", "shared_knowledge.md", "shared_files.md"]:
    content = readFileSync(resolve(MEMORY_DIR, file), "utf8")
    matches = content.split("\n").filter(l => l.includes(keyword))
    allEntries.push(...matches)

  if allEntries.length === 0:
    return `"${keyword}" 관련 기억을 찾지 못했어!`

  return `🔍 "${keyword}" 검색 결과 (${allEntries.length}건)\n${allEntries.join("\n")}`
```

#### remove(keyword, userId)
```
ADMIN_ID = "925580658917646397"

function remove(keyword, userId):
  if userId !== ADMIN_ID:
    return { success: false, message: "지식 삭제는 관리자만 할 수 있어!" }

  removed = 0
  for file of ["shared_links.md", "shared_knowledge.md", "shared_files.md"]:
    filePath = resolve(MEMORY_DIR, file)
    content = readFileSync(filePath, "utf8")
    lines = content.split("\n")
    filtered = lines.filter(l => !l.includes(keyword))
    if filtered.length < lines.length:
      removed += lines.length - filtered.length
      writeFileSync(filePath, filtered.join("\n"), "utf8")

  return removed > 0
    ? { success: true, message: `${removed}건 삭제했어!` }
    : { success: false, message: `"${keyword}" 관련 항목을 찾지 못했어.` }
```

#### loadMemoryContext()
```
function loadMemoryContext():
  parts = []
  for file of ["shared_links.md", "shared_knowledge.md", "shared_files.md"]:
    try:
      content = readFileSync(resolve(MEMORY_DIR, file), "utf8").trim()
      if content:
        parts.push(`## memory/${file}\n${content}`)
    catch: continue

  return parts.length > 0
    ? "## 멤버들이 공유한 기억 (memory/)\n\n" + parts.join("\n\n")
    : ""
```

### 3.4 memory/ 초기 파일

각 파일은 빈 상태로 시작:
```markdown
# shared_links.md (초기 내용 없음)
# shared_knowledge.md (초기 내용 없음)
# shared_files.md (초기 내용 없음)
```

### 3.5 chat.mjs 연동

`buildSystemInstruction()`에 memory 컨텍스트를 추가:
```
// 기존 knowledgeText 이후에 추가
const memoryText = loadMemoryContext()
return [...기존 부분, memoryText].join("\n")
```

**주의**: memory가 커지면 시스템 프롬프트 토큰이 증가. 현재는 소규모 운영이므로 문제 없음. TODO #6(토큰 최적화)에서 대응.

---

## 4. Module Design: scheduler.mjs

### 4.1 목적
node-cron으로 주간 다이제스트와 모임 리마인더를 자동 발송

### 4.2 API

```javascript
/**
 * Cron 작업을 등록하고 시작
 * @param {Client} client - Discord.js Client
 */
export function start(client)

/**
 * 주간 다이제스트 생성 및 발송 (수동 트리거용으로도 export)
 */
export async function weeklyDigest(client)

/**
 * 모임 리마인더 생성 및 발송
 */
export async function meetingReminder(client)
```

### 4.3 구현 상세

#### start(client)
```
import cron from "node-cron"

const DIGEST_CHANNEL_ID = "1484166024923316344"

function start(client):
  // 주간 다이제스트: 월요일 09:00 KST = UTC 00:00
  cron.schedule("0 0 * * 1", () => {
    weeklyDigest(client).catch(err =>
      console.error("[scheduler] Digest failed:", err.message))
  }, { timezone: "Asia/Seoul" })
  // note: node-cron v3는 timezone 옵션 지원

  // 모임 리마인더: 화요일 09:00 KST
  cron.schedule("0 9 * * 2", () => {
    meetingReminder(client).catch(err =>
      console.error("[scheduler] Reminder failed:", err.message))
  }, { timezone: "Asia/Seoul" })

  console.log("[scheduler] Cron jobs registered (digest: Mon 09:00, reminder: Tue 09:00)")
```

#### weeklyDigest(client)
```
async function weeklyDigest(client):
  channel = await client.channels.fetch(DIGEST_CHANNEL_ID)
  if !channel:
    console.error("[scheduler] Digest channel not found")
    return

  // 현재 주차 계산
  startDate = new Date("2026-03-10")
  now = new Date()
  weekNum = Math.ceil((now - startDate) / (7 * 86400000))

  // 이번 주 월~일 범위
  monday = getMonday(now)
  sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  dateRange = `${formatDate(monday)} ~ ${formatDate(sunday)}`

  // 스케줄 파싱 (02_7gi_schedule.md에서 이번 주 일정 추출)
  scheduleContent = readFileSync(SCHEDULE_PATH, "utf8")
  weekEvents = parseWeekEvents(scheduleContent, monday, sunday)

  // memory/ 최근 항목 수집
  memoryItems = getRecentMemoryItems(7) // 최근 7일

  // 주차별 맞춤 안내
  weekTip = getWeekTip(weekNum)

  // 메시지 조립
  lines = [
    `🏛️ **다오랩 주간 다이제스트** (${dateRange})`,
    "",
    `📅 **이번 주 일정**`,
  ]

  if weekEvents.length > 0:
    for event of weekEvents:
      lines.push(`- ${event}`)
  else:
    lines.push("- 이번 주는 정기 일정이 없어요")

  if memoryItems.length > 0:
    lines.push("")
    lines.push(`📝 **최근 공유된 지식** (${memoryItems.length}건)`)
    for item of memoryItems.slice(0, 5):
      lines.push(item)

  lines.push("")
  lines.push(`💡 **${weekNum}주차 포인트**`)
  lines.push(`- ${weekTip}`)
  lines.push("")
  lines.push("궁금한 게 있으면 언제든 물어봐!")

  message = lines.join("\n")
  await channel.send(message.slice(0, 1900))
  console.log(`[scheduler] Weekly digest sent (week ${weekNum})`)
```

#### meetingReminder(client)
```
async function meetingReminder(client):
  channel = await client.channels.fetch(DIGEST_CHANNEL_ID)
  if !channel: return

  // 오늘 날짜
  today = new Date()
  todayStr = formatDateISO(today) // "2026-03-24" 형식

  // 스케줄에서 오늘 일정 확인
  scheduleContent = readFileSync(SCHEDULE_PATH, "utf8")
  todayEvents = parseDayEvents(scheduleContent, todayStr)

  if todayEvents.length === 0:
    console.log("[scheduler] No meeting today, skipping reminder")
    return

  lines = [
    `📢 **오늘 모임 리마인더!**`,
    "",
  ]

  for event of todayEvents:
    lines.push(`- ${event}`)

  lines.push("")
  lines.push("📍 모두의연구소 강남캠퍼스 (강남역 도보 5분)")
  lines.push("오늘도 좋은 시간 보내요!")

  await channel.send(lines.join("\n"))
  console.log(`[scheduler] Meeting reminder sent for ${todayStr}`)
```

### 4.4 헬퍼 함수

```javascript
// 스케줄 파싱: 02_7gi_schedule.md의 테이블에서 날짜 범위 내 이벤트 추출
function parseWeekEvents(scheduleContent, monday, sunday):
  // 테이블 행을 파싱: "| 2026-03-24(화) | 19:30~22:00 | 조별 플랜 발표 | 오프라인 |"
  // 날짜가 monday~sunday 범위 내인 행 추출
  // 반환: ["3/24(화) 19:30~22:00 — 조별 플랜 발표 (오프라인)"]

function parseDayEvents(scheduleContent, todayStr):
  // todayStr(YYYY-MM-DD)와 일치하는 행 추출

function getWeekTip(weekNum):
  if weekNum <= 3: return "온보딩 기간이에요! 자기소개 슬라이드를 아직 안 했다면 지금 해보세요"
  if weekNum <= 9: return "조별 연구가 진행 중이에요. 팀원들과 이번 주 목표를 정해보세요"
  return "발표 준비 기간이에요! 연구 결과를 정리하고 발표 자료를 준비해보세요"

function getMonday(date):
  // 해당 주의 월요일 반환

function formatDate(date):
  // "3/17" 형식

function formatDateISO(date):
  // "2026-03-17" 형식

function getRecentMemoryItems(days):
  // memory/ 파일에서 최근 N일 내 항목 추출
  // 각 줄의 [YYYY-MM-DD] 파싱하여 필터링
```

### 4.5 node-cron timezone 설정
node-cron v3는 `timezone` 옵션을 직접 지원:
```javascript
cron.schedule("0 9 * * 1", callback, { timezone: "Asia/Seoul" })
```
UTC 변환 없이 KST 기준으로 직접 설정 가능.

---

## 5. Module Design: admin.mjs + commands/admin.mjs

### 5.1 commands/admin.mjs (슬래시 커맨드 정의)

```javascript
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js"

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("관리자 전용 명령어")
  .addSubcommand(sub =>
    sub.setName("reload")
      .setDescription("knowledge 파일 리로드"))
  .addSubcommand(sub =>
    sub.setName("memory")
      .setDescription("메모리 현황 조회"))
  .addSubcommand(sub =>
    sub.setName("status")
      .setDescription("봇 상태 확인"))
  .addSubcommand(sub =>
    sub.setName("digest")
      .setDescription("주간 다이제스트 수동 발송"))

export async function execute(interaction):
  // admin.mjs로 위임
  import { handleAdmin } from "../admin.mjs"
  await handleAdmin(interaction)
```

### 5.2 admin.mjs (로직)

```javascript
const ADMIN_ID = "925580658917646397"
const BOT_START_TIME = Date.now()

export async function handleAdmin(interaction):
  // 관리자 검증 (최우선)
  if interaction.user.id !== ADMIN_ID:
    await interaction.reply({
      content: "관리자 전용 명령어야! 🔒",
      ephemeral: true
    })
    return

  const sub = interaction.options.getSubcommand()

  switch sub:
    case "reload":  await handleReload(interaction)
    case "memory":  await handleMemory(interaction)
    case "status":  await handleStatus(interaction)
    case "digest":  await handleDigest(interaction)
```

#### handleReload(interaction)
```
async function handleReload(interaction):
  // chat.mjs의 knowledge 리로드
  const count = reloadKnowledge()  // chat.mjs에서 export할 함수
  await interaction.reply({
    content: `knowledge ${count}개 파일 리로드 완료! ✅`,
    ephemeral: true
  })
```

#### handleMemory(interaction)
```
async function handleMemory(interaction):
  const summary = memory.list()
  await interaction.reply({
    content: summary.slice(0, 1900),
    ephemeral: true
  })
```

#### handleStatus(interaction)
```
async function handleStatus(interaction):
  const uptime = Math.floor((Date.now() - BOT_START_TIME) / 60000)
  const guilds = interaction.client.guilds.cache.size
  const channels = interaction.client.channels.cache.size
  const historySize = getHistorySize()  // chat.mjs에서 export

  const status = [
    "📊 **봇 상태**",
    `- Uptime: ${uptime}분`,
    `- 서버: ${guilds}개`,
    `- 채널: ${channels}개`,
    `- 히스토리: ${historySize}개 메시지`,
  ].join("\n")

  await interaction.reply({ content: status, ephemeral: true })
```

#### handleDigest(interaction)
```
async function handleDigest(interaction):
  await interaction.deferReply({ ephemeral: true })
  await weeklyDigest(interaction.client)  // scheduler.mjs에서 import
  await interaction.editReply("주간 다이제스트 발송 완료! ✅")
```

---

## 6. Modification Design: bot.mjs

### 6.1 변경 내용

기존 `bot.mjs`의 ClientReady 이벤트에 모듈 초기화를 추가하고, MessageCreate에 memory.detect()를 추가.

### 6.2 import 추가

```javascript
// 기존 import 아래에 추가
import { restoreAll } from "./history.mjs";
import { detect as detectMemory } from "./memory.mjs";
import { start as startScheduler } from "./scheduler.mjs";
```

### 6.3 ClientReady 수정

```javascript
// 기존:
client.once(Events.ClientReady, (c) => {
  console.log(`[bot] Ready! Logged in as ${c.user.tag} (다오랑/오랑)`);
  console.log(`[bot] Serving ${c.guilds.cache.size} guild(s)`);
});

// 변경 후:
client.once(Events.ClientReady, async (c) => {
  console.log(`[bot] Ready! Logged in as ${c.user.tag} (다오랑/오랑)`);
  console.log(`[bot] Serving ${c.guilds.cache.size} guild(s)`);

  // 히스토리 복원
  try {
    const restored = await restoreAll(c, addContext);
    console.log(`[bot] History restored: ${restored} messages`);
  } catch (err) {
    console.error("[bot] History restore failed:", err.message);
  }

  // Cron 스케줄러 시작
  startScheduler(c);
});
```

### 6.4 MessageCreate 수정

```javascript
// 기존 addContext 호출 이후, 봇 멘션 체크 이전에 추가:
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const displayName = message.member?.displayName || message.author.displayName;
  addContext(message.channel.id, displayName, message.content);

  // ✨ 기억하기 감지 (멘션 없이도 작동)
  const memResult = detectMemory(message);
  if (memResult.detected && memResult.response) {
    await message.reply(memResult.response);
    if (!message.mentions.has(client.user) && !NAME_PATTERN.test(message.content)) {
      return; // 기억하기만 하고 AI 응답은 건너뛰기
    }
  }

  // 봇 @멘션 또는 이름 호출 시에만 응답 (기존 로직)
  const mentioned = message.mentions.has(client.user);
  const nameCalled = NAME_PATTERN.test(message.content);
  if (!mentioned && !nameCalled) return;

  // ... 기존 chat() 호출 로직 동일
});
```

---

## 7. Modification Design: chat.mjs

### 7.1 변경 내용

1. `loadKnowledge()`를 외부에서 재호출 가능하도록 리팩터
2. `loadMemoryContext()`를 시스템 프롬프트에 포함
3. `getHistorySize()` export 추가

### 7.2 knowledge 리로드 지원

```javascript
// 기존: const knowledge = loadKnowledge();
// 변경: let으로 변경 + reloadKnowledge 함수 추가

let knowledge = loadKnowledge();

export function reloadKnowledge() {
  knowledge = loadKnowledge();
  // 모델 재초기화 (새 시스템 프롬프트 반영)
  initialized = false;
  model = null;
  return Object.keys(knowledge).length;
}
```

### 7.3 시스템 프롬프트에 memory 추가

```javascript
import { loadMemoryContext } from "./memory.mjs";

function buildSystemInstruction() {
  // ... 기존 코드 동일 ...

  const memoryText = loadMemoryContext();  // ✨ 추가

  return [
    soul,
    "",
    `## 현재 시간 정보`,
    `- 오늘: ${today}`,
    `- 7기 진행: ${weekStr} (시작일: 2026-03-10)`,
    "",
    `## 참조 지식 (knowledge/)`,
    knowledgeText,
    "",
    memoryText,  // ✨ 추가
  ].join("\n");
}
```

### 7.4 히스토리 크기 export

```javascript
export function getHistorySize() {
  let total = 0;
  for (const history of channelHistories.values()) {
    total += history.length;
  }
  return total;
}
```

---

## 8. package.json 변경

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "discord.js": "^14.16.0",
    "node-cron": "^3.0.0"
  }
}
```

---

## 9. Implementation Order & Checklist

### Step 1: memory.mjs + memory/ 폴더 (기반)
- [ ] `daolab-bot/memory/` 폴더 생성
- [ ] `shared_links.md`, `shared_knowledge.md`, `shared_files.md` 빈 파일 생성
- [ ] `memory.mjs` 구현: detect(), list(), search(), remove(), loadMemoryContext()
- [ ] `chat.mjs` 수정: `let knowledge` + `reloadKnowledge()` + `getHistorySize()` + `loadMemoryContext()` 연동
- [ ] `bot.mjs` 수정: MessageCreate에 `detectMemory()` 추가
- [ ] ✅ 테스트: "기억해줘 https://example.com" → shared_links.md에 저장 확인

### Step 2: history.mjs (운영 안정성)
- [ ] `history.mjs` 구현: restoreAll()
- [ ] `bot.mjs` 수정: ClientReady에 restoreAll() 호출 추가
- [ ] ✅ 테스트: 봇 재시작 후 이전 대화 맥락 확인

### Step 3: scheduler.mjs (능동적 메시징)
- [ ] `package.json`에 node-cron 추가
- [ ] `scheduler.mjs` 구현: start(), weeklyDigest(), meetingReminder()
- [ ] `bot.mjs` 수정: ClientReady에 startScheduler() 호출 추가
- [ ] ✅ 테스트: /admin digest로 수동 다이제스트 발송 확인

### Step 4: admin.mjs + commands/admin.mjs (관리자 도구)
- [ ] `commands/admin.mjs` 구현: 슬래시 커맨드 정의
- [ ] `admin.mjs` 구현: handleAdmin(), handleReload(), handleMemory(), handleStatus(), handleDigest()
- [ ] `deploy-commands.mjs` 실행하여 /admin 등록
- [ ] ✅ 테스트: /admin status, /admin reload 동작 확인

### Step 5: 통합 테스트 + 배포
- [ ] 기존 기능 호환성: 멘션 응답, 웹검색, URL 읽기
- [ ] 메모리 연동: "기억해줘" → 저장 → AI 답변에 반영
- [ ] rsync 원격 동기화
- [ ] npm install (node-cron)
- [ ] deploy-commands.mjs 실행
- [ ] PM2 재시작 + 로그 확인

---

## 10. File-Level Change Summary

| 파일 | 변경 | 줄 수 (예상) | 핵심 변경 |
|------|------|-------------|----------|
| history.mjs | 신규 | ~50줄 | restoreAll() |
| memory.mjs | 신규 | ~120줄 | detect/list/search/remove/loadMemoryContext |
| scheduler.mjs | 신규 | ~150줄 | start/weeklyDigest/meetingReminder + 헬퍼 |
| admin.mjs | 신규 | ~80줄 | handleAdmin + 4개 서브커맨드 |
| commands/admin.mjs | 신규 | ~30줄 | SlashCommandBuilder |
| bot.mjs | 수정 | +15줄 | import 3개 + ClientReady async + detectMemory |
| chat.mjs | 수정 | +20줄 | let knowledge + reloadKnowledge + getHistorySize + memory import |
| package.json | 수정 | +1줄 | node-cron 의존성 |
| memory/*.md | 신규 | 0줄 | 빈 파일 3개 |

**총 신규 코드**: ~430줄 (5개 파일)
**기존 코드 수정**: ~35줄 (2개 파일)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-19 | Initial design — 4 modules detailed spec | wine_ny |
