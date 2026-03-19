// --- Scheduler: Cron 기반 주간 다이제스트 + 모임 리마인더 + Heartbeat 순찰 ---
import cron from "node-cron";
import { PROGRAM_START, getDigestChannelId } from "./config.mjs";
import { loadLearningsContext } from "./learnings.mjs";
import { getSecurityStats } from "./security.mjs";
import {
  parseWeekEvents,
  parseDayEvents,
  getWeekTip,
  getRecentMemoryItems,
  getMonday,
  formatShort,
  formatISO,
} from "./schedule-utils.mjs";

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
  lines.push("궁금한 게 있으면 언제든 물어봐주세요!");

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
