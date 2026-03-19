// --- Memory: 기억하기 기능 (파일 기반 영구 저장) ---
import { readFileSync, appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = resolve(__dirname, "memory");
const ADMIN_ID = "925580658917646397";

const FILES = ["shared_links.md", "shared_knowledge.md", "shared_files.md"];

const SAVE_PATTERNS = [
  /기억해\s?줘/,
  /이거\s?기억해/,
  /저장해\s?줘/,
  /메모해\s?줘/,
];

const SENSITIVE_PATTERNS = [
  /\d{2,3}-\d{3,4}-\d{4}/, // 전화번호
  /비밀번호|비번|패스워드|password/i,
  /주민등록|주민번호/,
];

// memory/ 디렉토리 보장
try {
  mkdirSync(MEMORY_DIR, { recursive: true });
} catch {}

/**
 * 메시지에서 "기억해줘" 패턴 감지 → 파일 저장
 * @returns {{ detected: boolean, response: string | null }}
 */
export function detect(message) {
  const text = message.content;

  if (!SAVE_PATTERNS.some((p) => p.test(text))) {
    return { detected: false, response: null };
  }

  // 민감정보 차단
  if (SENSITIVE_PATTERNS.some((p) => p.test(text))) {
    return {
      detected: true,
      response: "그건 민감한 정보라 저장하지 않는 게 좋겠어!",
    };
  }

  // 내용 추출 (패턴 키워드 제거)
  let content = text;
  for (const p of SAVE_PATTERNS) {
    content = content.replace(p, "");
  }
  content = content.replace(/다오랑|오랑아?|@\S+/g, "").trim();

  if (!content) {
    return { detected: true, response: "뭘 기억하면 될까? 내용을 함께 말해줘!" };
  }

  const displayName =
    message.member?.displayName || message.author.displayName;
  const date = new Date()
    .toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })
    .replace(/\. /g, "-")
    .replace(".", "");
  const isoDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  )
    .toISOString()
    .slice(0, 10);

  const entry = `- [${isoDate}] @${displayName}: ${content}`;

  // URL 포함 → links, 아니면 knowledge
  const hasUrl = /https?:\/\/[^\s]+/.test(content);
  const targetFile = hasUrl ? "shared_links.md" : "shared_knowledge.md";

  try {
    appendFileSync(resolve(MEMORY_DIR, targetFile), entry + "\n", "utf8");
  } catch (err) {
    console.error("[memory] Write failed:", err.message);
    return { detected: true, response: "기억하려다 오류가 생겼어. 다시 시도해줘!" };
  }

  const summary = content.length > 50 ? content.slice(0, 50) + "..." : content;
  console.log(`[memory] Saved to ${targetFile}: ${entry}`);
  return { detected: true, response: `기억했어! ✅ ${summary}` };
}

/**
 * memory/ 파일 목록 조회
 */
export function list(category = null) {
  const targets = category ? [categoryToFile(category)] : FILES;
  const result = [];

  for (const file of targets) {
    try {
      const content = readFileSync(resolve(MEMORY_DIR, file), "utf8");
      const lines = content
        .split("\n")
        .filter((l) => l.startsWith("- ["));
      if (lines.length === 0) continue;

      const recent = lines.slice(-5);
      const header = file.replace(".md", "").replace("shared_", "");
      result.push(`📂 ${header} (${lines.length}건, 최근 5개)`);
      result.push(...recent);
      result.push("");
    } catch {
      continue;
    }
  }

  return result.length > 0 ? result.join("\n") : "아직 저장된 기억이 없어!";
}

/**
 * memory/ 파일에서 키워드 검색
 */
export function search(keyword) {
  const allEntries = [];

  for (const file of FILES) {
    try {
      const content = readFileSync(resolve(MEMORY_DIR, file), "utf8");
      const matches = content
        .split("\n")
        .filter((l) => l.toLowerCase().includes(keyword.toLowerCase()));
      allEntries.push(...matches);
    } catch {
      continue;
    }
  }

  if (allEntries.length === 0) {
    return `"${keyword}" 관련 기억을 찾지 못했어!`;
  }

  return `🔍 "${keyword}" 검색 결과 (${allEntries.length}건)\n${allEntries.join("\n")}`;
}

/**
 * memory/ 파일에서 항목 삭제 (관리자만)
 */
export function remove(keyword, userId) {
  if (userId !== ADMIN_ID) {
    return { success: false, message: "지식 삭제는 관리자만 할 수 있어!" };
  }

  let removed = 0;

  for (const file of FILES) {
    try {
      const filePath = resolve(MEMORY_DIR, file);
      const content = readFileSync(filePath, "utf8");
      const lines = content.split("\n");
      const filtered = lines.filter(
        (l) => !l.toLowerCase().includes(keyword.toLowerCase())
      );
      if (filtered.length < lines.length) {
        removed += lines.length - filtered.length;
        writeFileSync(filePath, filtered.join("\n"), "utf8");
      }
    } catch {
      continue;
    }
  }

  return removed > 0
    ? { success: true, message: `${removed}건 삭제했어!` }
    : { success: false, message: `"${keyword}" 관련 항목을 찾지 못했어.` };
}

/**
 * memory/ 전체 내용을 시스템 프롬프트용 텍스트로 반환
 */
export function loadMemoryContext() {
  const parts = [];

  for (const file of FILES) {
    try {
      const content = readFileSync(resolve(MEMORY_DIR, file), "utf8").trim();
      if (content) {
        parts.push(`## memory/${file}\n${content}`);
      }
    } catch {
      continue;
    }
  }

  return parts.length > 0
    ? "## 멤버들이 공유한 기억 (memory/)\n\n" + parts.join("\n\n")
    : "";
}

function categoryToFile(category) {
  const map = {
    links: "shared_links.md",
    link: "shared_links.md",
    링크: "shared_links.md",
    knowledge: "shared_knowledge.md",
    지식: "shared_knowledge.md",
    files: "shared_files.md",
    파일: "shared_files.md",
  };
  return map[category] || "shared_knowledge.md";
}
