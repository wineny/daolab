// --- Schedule Utilities: 날짜 파싱 + 메모리 조회 헬퍼 ---
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MEMORY_DIR, KNOWLEDGE_DIR } from "./config.mjs";

const SCHEDULE_PATH = resolve(KNOWLEDGE_DIR, "02_7gi_schedule.md");

/**
 * 주간 일정 파싱 — 해당 주의 이벤트 목록 반환
 */
export function parseWeekEvents(monday, sunday) {
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

/**
 * 특정 날짜의 이벤트 파싱
 */
export function parseDayEvents(todayStr) {
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

/**
 * 주차별 안내 팁
 */
export function getWeekTip(weekNum) {
  if (weekNum <= 0)
    return "곧 7기가 시작돼요! 온보딩 퀘스트를 미리 확인해보세요";
  if (weekNum <= 3)
    return "온보딩 기간이에요! 자기소개 슬라이드를 아직 안 했다면 지금 해보세요";
  if (weekNum <= 9)
    return "조별 연구가 진행 중이에요. 팀원들과 이번 주 목표를 정해보세요";
  return "발표 준비 기간이에요! 연구 결과를 정리하고 발표 자료를 준비해보세요";
}

/**
 * 최근 N일간 memory 변경 항목 조회
 */
export function getRecentMemoryItems(days) {
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

/**
 * 해당 주의 월요일 반환
 */
export function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 짧은 날짜 형식 (M/D)
 */
export function formatShort(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * ISO 날짜 형식 (YYYY-MM-DD)
 */
export function formatISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
