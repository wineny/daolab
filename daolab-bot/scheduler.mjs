// --- Scheduler: Cron 기반 주간 다이제스트 + 모임 리마인더 + Heartbeat 순찰 ---
import cron from "node-cron";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  MEMORY_DIR,
  KNOWLEDGE_DIR,
  PROGRAM_START,
  getDigestChannelId,
} from "./config.mjs";
import { loadLearningsContext } from "./learnings.mjs";
import { getSecurityStats } from "./security.mjs";

const SCHEDULE_PATH = resolve(KNOWLEDGE_DIR, "02_7gi_schedule.md");

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

  // Heartbeat 순찰: 6시간마다 (0:00, 6:00, 12:00, 18:00 KST)
  cron.schedule(
    "0 */6 * * *",
    () => {
      heartbeat(client).catch((err) =>
        console.error("[scheduler] Heartbeat failed:", err.message)
      );
    },
    { timezone: "Asia/Seoul" }
  );

  console.log(
    "[scheduler] Cron registered — digest: Mon 09:00, reminder: Tue 09:00, heartbeat: every 6h"
  );
}

/**
 * 주간 다이제스트 생성 및 발송
 */
export async function weeklyDigest(client) {
  const channel = await client.channels.fetch(getDigestChannelId());
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

  const weekEvents = parseWeekEvents(monday, sunday);
  const memoryItems = getRecentMemoryItems(7);
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
  await channel.send(
    message.length > 1900 ? message.slice(0, 1900) + "..." : message
  );
  console.log(`[scheduler] Weekly digest sent (week ${weekNum})`);
}

/**
 * 모임 리마인더 발송
 */
export async function meetingReminder(client) {
  const channel = await client.channels.fetch(getDigestChannelId());
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

/**
 * Heartbeat 순찰 (bbojjak 레슨 #09)
 * 6시간마다 일정/메모리/learnings 확인 → 필요 시 알림
 */
export async function heartbeat(client) {
  const channel = await client.channels.fetch(getDigestChannelId());
  if (!channel) return;

  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const alerts = [];

  // 1. 24시간 이내 모임 확인
  const todayEvents = parseDayEvents(formatISO(now));
  const tomorrowEvents = parseDayEvents(formatISO(tomorrow));

  if (todayEvents.length > 0) {
    alerts.push(
      `📢 오늘 모임이 있어요!\n${todayEvents.map((e) => `- ${e}`).join("\n")}`
    );
  }
  if (tomorrowEvents.length > 0) {
    alerts.push(
      `📢 내일 모임이 있어요!\n${tomorrowEvents.map((e) => `- ${e}`).join("\n")}`
    );
  }

  // 2. 최근 24시간 memory 변경 확인
  const recentItems = getRecentMemoryItems(1);
  if (recentItems.length > 0) {
    alerts.push(`📝 최근 24시간 공유된 지식: ${recentItems.length}건`);
  }

  // 3. learnings 확인 (새 학습 기록 여부)
  const learnings = loadLearningsContext();
  if (learnings) {
    const count = (learnings.match(/^- \[/gm) || []).length;
    if (count > 0) {
      alerts.push(`📚 누적 오류 학습: ${count}건`);
    }
  }

  // 4. 보안 통계 (bbojjak #18)
  const secStats = getSecurityStats();
  if (secStats.recent24h > 0) {
    alerts.push(`🛡️ 최근 24시간 인젝션 차단: ${secStats.recent24h}건`);
  }

  // 알림이 있을 때만 발송
  if (alerts.length > 0) {
    const message = `🔍 **다오랑 순찰 보고**\n\n${alerts.join("\n\n")}`;
    await channel.send(
      message.length > 1900 ? message.slice(0, 1900) + "..." : message
    );
    console.log(`[scheduler] Heartbeat: ${alerts.length} alerts sent`);
  } else {
    console.log("[scheduler] Heartbeat: all clear");
  }
}

// --- 헬퍼 함수 ---

function parseWeekEvents(monday, sunday) {
  try {
    const content = readFileSync(SCHEDULE_PATH, "utf8");
    const lines = content.split("\n");
    const events = [];

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
  if (weekNum <= 0)
    return "곧 7기가 시작돼요! 온보딩 퀘스트를 미리 확인해보세요";
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
