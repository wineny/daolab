// --- Learnings: 봇 오류학습 시스템 (bbojjak 레슨 #05) ---
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { MEMORY_DIR, ADMIN_ID } from "./config.mjs";

const LEARNINGS_FILE = resolve(MEMORY_DIR, "learnings.md");

// memory/ 디렉토리 보장
try {
  mkdirSync(MEMORY_DIR, { recursive: true });
} catch {}

// 관리자 오류 피드백 패턴
const FEEDBACK_PATTERNS = [
  /이건\s*틀렸/,
  /잘못\s*(된|됐|했)/,
  /그게\s*아니/,
  /틀렸어/,
  /오류야/,
  /아닌데/,
  /정정/,
];

/**
 * 관리자의 오류 피드백 감지 (봇 메시지 답글에서만)
 * @returns {{ detected: boolean }}
 */
export function detectFeedback(message) {
  if (message.author.id !== ADMIN_ID) return { detected: false };
  if (!FEEDBACK_PATTERNS.some((p) => p.test(message.content))) {
    return { detected: false };
  }
  return { detected: true };
}

/**
 * 오류 학습 기록
 * @param {string} content - 실수 + 수정 내용
 * @param {string} source - 피드백 출처 닉네임
 */
export function recordLearning(content, source) {
  const isoDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  )
    .toISOString()
    .slice(0, 10);

  const entry = `- [${isoDate}] @${source}: ${content}`;

  try {
    appendFileSync(LEARNINGS_FILE, entry + "\n", "utf8");
    console.log(`[learnings] Recorded: ${entry}`);
    return true;
  } catch (err) {
    console.error("[learnings] Write failed:", err.message);
    return false;
  }
}

/**
 * learnings를 시스템 프롬프트용으로 반환
 */
export function loadLearningsContext() {
  try {
    const content = readFileSync(LEARNINGS_FILE, "utf8").trim();
    if (!content) return "";
    return (
      "## 오류 학습 기록 (learnings)\n" +
      "이전에 틀렸던 것들. 같은 실수 반복 금지!\n" +
      content
    );
  } catch {
    return "";
  }
}

/**
 * learnings 목록 조회 (관리자용)
 */
export function listLearnings() {
  try {
    const content = readFileSync(LEARNINGS_FILE, "utf8");
    const lines = content.split("\n").filter((l) => l.startsWith("- ["));
    if (lines.length === 0) return "아직 학습된 오류가 없어!";
    const recent = lines.slice(-10);
    return `📚 오류 학습 (${lines.length}건, 최근 10개)\n${recent.join("\n")}`;
  } catch {
    return "아직 학습된 오류가 없어!";
  }
}
