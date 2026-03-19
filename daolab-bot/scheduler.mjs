// --- Scheduler: Cron 기반 주간 다이제스트 + 모임 리마인더 ---
import cron from "node-cron";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEDULE_PATH = resolve(__dirname, "..", "knowledge", "02_7gi_schedule.md");
const MEMORY_DIR = resolve(__dirname, "memory");
const DIGEST_CHANNEL_ID = "1484166024923316344";
const PROGRAM_START = new Date("2026-03-10");

/**
 * Cron 작업 등록 및 시작
 * @param {import("discord.js").Client} client
 */
export function start(client) {
  // 주간 다이제스트: 월요일 09:00 KST
  cron.schedule(
    "0 9 * * 1",
    () => {
      weeklyDigest(client).catch((err) =>
        console.error("[scheduler] Digest failed:", err.message)
      );
    },
    { timezone: "Asia/Seoul" }
  );

  // 모임 리마인더: 화요일 09:00 KST
  cron.schedule(
    "0 9 * * 2",
    () => {
      meetingReminder(client).catch((err) =>
        console.error("[scheduler] Reminder failed:", err.message)
      );
    },
    { timezone: "Asia/Seoul" }
  );

  console.log(
    "[scheduler] Cron registered — digest: Mon 09:00 KST, reminder: Tue 09:00 KST"
  );
}

/**
 * 주간 다이제스트 생성 및 발송
 */
export async function weeklyDigest(client) {
  const channel = await client.channels.fetch(DIGEST_CHANNEL_ID);
  if (!channel) {
    console.error("[scheduler] Digest channel not found");
    return;
  }

  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  const weekNum = Math.ceil((now - PROGRAM_START) / (7 * 86400000));
  const monday = getMonday(now);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const dateRange = `${formatShort(monday)} ~ ${formatShort(sunday)}`;

  // 스케줄에서 이번 주 일정 추출
  const weekEvents = parseWeekEvents(monday, sunday);

  // memory/ 최근 항목 수집
  const memoryItems = getRecentMemoryItems(7);

  // 주차별 맞춤 안내
  const weekTip = getWeekTip(weekNum);

  const lines = [
    `🏛️ **다오랩 주간 다이제스트** (${dateRange})`,
    "",
    "📅 **이번 주 일정**",
  ];

  if (weekEvents.length > 0) {
    for (const event of weekEvents) {
      lines.push(`- ${event}`);
    }
  } else {
    lines.push("- 이번 주는 정기 일정이 없어요");
  }

  if (memoryItems.length > 0) {
    lines.push("");
    lines.push(`📝 **최근 공유된 지식** (${memoryItems.length}건)`);
    for (const item of memoryItems.slice(0, 5)) {
      lines.push(item);
    }
  }

  lines.push("");
  lines.push(`💡 **${weekNum > 0 ? weekNum + "주차" : ""} 포인트**`);
  lines.push(`- ${weekTip}`);
  lines.push("");
  lines.push("궁금한 게 있으면 언제든 물어봐!");

  const message = lines.join("\n");
  await channel.send(message.length > 1900 ? message.slice(0, 1900) + "..." : message);
  console.log(`[scheduler] Weekly digest sent (week ${weekNum})`);
}

/**
 * 모임 리마인더 발송
 */
export async function meetingReminder(client) {
  const channel = await client.channels.fetch(DIGEST_CHANNEL_ID);
  if (!channel) return;

  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  const todayStr = formatISO(now);

  const todayEvents = parseDayEvents(todayStr);

  if (todayEvents.length === 0) {
    console.log("[scheduler] No meeting today, skipping reminder");
    return;
  }

  const lines = [
    "📢 **오늘 모임 리마인더!**",
    "",
    ...todayEvents.map((e) => `- ${e}`),
    "",
    "📍 모두의연구소 강남캠퍼스 (강남역 도보 5분)",
    "오늘도 좋은 시간 보내요!",
  ];

  await channel.send(lines.join("\n"));
  console.log(`[scheduler] Meeting reminder sent for ${todayStr}`);
}

// --- 헬퍼 함수 ---

function parseWeekEvents(monday, sunday) {
  try {
    const content = readFileSync(SCHEDULE_PATH, "utf8");
    const lines = content.split("\n");
    const events = [];

    // 테이블 행 파싱: "| 2026-03-24(화) | 19:30~22:00 | 조별 플랜 발표 | 오프라인 |"
    for (const line of lines) {
      const match = line.match(
        /\|\s*(\d{4}-\d{2}-\d{2})\([^)]+\)\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|/
      );
      if (!match) continue;

      const eventDate = new Date(match[1] + "T00:00:00");
      if (eventDate >= monday && eventDate <= sunday) {
        const dateStr = `${eventDate.getMonth() + 1}/${eventDate.getDate()}`;
        const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
        const dayName = dayNames[eventDate.getDay()];
        const time = match[2].trim();
        const title = match[3].trim();
        const type = match[4].trim();

        const timeStr = time && time !== "-" ? ` ${time}` : "";
        const typeStr = type ? ` (${type})` : "";
        events.push(`${dateStr}(${dayName})${timeStr} — ${title}${typeStr}`);
      }
    }

    return events;
  } catch (err) {
    console.error("[scheduler] Schedule parse failed:", err.message);
    return [];
  }
}

function parseDayEvents(todayStr) {
  try {
    const content = readFileSync(SCHEDULE_PATH, "utf8");
    const lines = content.split("\n");
    const events = [];

    for (const line of lines) {
      if (!line.includes(todayStr)) continue;

      const match = line.match(
        /\|\s*\d{4}-\d{2}-\d{2}\([^)]+\)\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|/
      );
      if (!match) continue;

      const time = match[1].trim();
      const title = match[2].trim();
      const type = match[3].trim();

      const timeStr = time && time !== "-" ? `${time} ` : "";
      const typeStr = type ? ` (${type})` : "";
      events.push(`${timeStr}${title}${typeStr}`);
    }

    return events;
  } catch {
    return [];
  }
}

function getWeekTip(weekNum) {
  if (weekNum <= 0) return "곧 7기가 시작돼요! 온보딩 퀘스트를 미리 확인해보세요";
  if (weekNum <= 3)
    return "온보딩 기간이에요! 자기소개 슬라이드를 아직 안 했다면 지금 해보세요";
  if (weekNum <= 9)
    return "조별 연구가 진행 중이에요. 팀원들과 이번 주 목표를 정해보세요";
  return "발표 준비 기간이에요! 연구 결과를 정리하고 발표 자료를 준비해보세요";
}

function getRecentMemoryItems(days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = formatISO(cutoff);

  const items = [];
  const files = ["shared_links.md", "shared_knowledge.md", "shared_files.md"];

  for (const file of files) {
    try {
      const content = readFileSync(resolve(MEMORY_DIR, file), "utf8");
      for (const line of content.split("\n")) {
        const dateMatch = line.match(/\[(\d{4}-\d{2}-\d{2})\]/);
        if (dateMatch && dateMatch[1] >= cutoffStr) {
          items.push(line);
        }
      }
    } catch {
      continue;
    }
  }

  return items;
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatShort(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
