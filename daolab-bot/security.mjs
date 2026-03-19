// --- Security: 인젝션 방어 + 민감정보 필터 + 공격 로깅 (bbojjak #17 + #18) ---
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MEMORY_DIR } from "./config.mjs";

const SECURITY_LOG = resolve(MEMORY_DIR, "security_log.md");

// 인젝션 패턴 + 라벨 (로깅용)
const INJECTION_PATTERNS = [
  { re: /시스템\s*프롬프트/i, label: "시스템프롬프트 탈취" },
  { re: /system\s*prompt/i, label: "system prompt leak" },
  { re: /너의?\s*(설정|지시|명령|규칙|소스|코드)/, label: "설정 탈취" },
  { re: /관리자\s*모드/, label: "관리자모드 탈취" },
  { re: /jailbreak/i, label: "jailbreak" },
  { re: /ignore\s+(previous|above|all)\s+(instructions?|prompts?)/i, label: "ignore instructions" },
  { re: /disregard\s+(previous|above|all)/i, label: "disregard prompt" },
  { re: /SOUL\.md/i, label: "SOUL.md 접근" },
  { re: /AGENTS\.md/i, label: "AGENTS.md 접근" },
  { re: /\.env\s*(파일|내용|보여)/i, label: ".env 탈취" },
  { re: /봇\s*(토큰|키|비밀)/, label: "봇 토큰 탈취" },
  { re: /서버\s*(IP|주소|경로|비밀번호)/, label: "서버정보 탈취" },
  { re: /SSH\s*(접속|정보|키)/i, label: "SSH 정보 탈취" },
];

// 민감정보 패턴
export const SENSITIVE_PATTERNS = [
  /\d{2,3}-\d{3,4}-\d{4}/,
  /비밀번호|비번|패스워드|password/i,
  /주민등록|주민번호/,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  /계좌\s*번호|account\s*num/i,
  /카드\s*번호|card\s*num/i,
  /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/,
];

/**
 * 인젝션 감지 — 매칭된 패턴 라벨 반환
 * @returns {{ blocked: boolean, label?: string }}
 */
export function checkInjection(text) {
  for (const { re, label } of INJECTION_PATTERNS) {
    if (re.test(text)) {
      console.warn(`[security] Blocked (${label}): "${text.slice(0, 60)}"`);
      return { blocked: true, label };
    }
  }
  return { blocked: false };
}

/** 민감정보 포함 여부 */
export function hasSensitiveInfo(text) {
  return SENSITIVE_PATTERNS.some((p) => p.test(text));
}

/**
 * 공격 시도 파일 로깅 (bbojjak #18)
 * 패턴별 누적으로 방어 트렌드 학습
 */
export function logAttack(userId, userName, channelId, text, label) {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const snippet = text.replace(/\n/g, " ").slice(0, 80);
  const entry = `- [${now}] @${userName}(${userId}) #${channelId}: "${snippet}" | ${label}\n`;
  try {
    appendFileSync(SECURITY_LOG, entry, "utf8");
  } catch (err) {
    console.error("[security] Log write failed:", err.message);
  }
}

/**
 * 보안 통계 — 전체 + 최근 24시간 차단 건수
 */
export function getSecurityStats() {
  try {
    const content = readFileSync(SECURITY_LOG, "utf8");
    const lines = content.split("\n").filter((l) => l.startsWith("- ["));

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    const cutoffStr = cutoff.toISOString().slice(0, 16).replace("T", " ");

    const recent = lines.filter((l) => {
      const m = l.match(/\[([^\]]+)\]/);
      return m && m[1] >= cutoffStr;
    });

    return { total: lines.length, recent24h: recent.length, last5: lines.slice(-5) };
  } catch {
    return { total: 0, recent24h: 0, last5: [] };
  }
}
