import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { webSearch, fetchUrl, extractUrls, needsSearch } from "./tools.mjs";
import { loadMemoryContext } from "./memory.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Load knowledge files ---
function loadKnowledge() {
  const knowledgeDir = resolve(__dirname, "..", "knowledge");
  const files = {};
  try {
    for (const f of readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"))) {
      files[f] = readFileSync(resolve(knowledgeDir, f), "utf8");
    }
    console.log(`[chat] Loaded ${Object.keys(files).length} knowledge files`);
  } catch (err) {
    console.warn("[chat] Knowledge dir not found:", err.message);
  }
  return files;
}

let knowledge = loadKnowledge();

// --- Build system instruction ---
function buildSystemInstruction() {
  const soul = knowledge["SOUL.md"] || "";
  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });

  const startDate = new Date("2026-03-10");
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  const weekNum = Math.ceil((now - startDate) / (7 * 24 * 60 * 60 * 1000));
  const weekStr = weekNum > 0 ? `${weekNum}주차` : "시작 전";

  const knowledgeText = Object.entries(knowledge)
    .filter(([name]) => name !== "SOUL.md" && name !== "AGENTS.md")
    .map(([name, content]) => `## ${name}\n${content}`)
    .join("\n\n---\n\n");

  const memoryText = loadMemoryContext();

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
    memoryText,
  ].join("\n");
}

// --- Lazy-init Gemini ---
let model = null;
let initialized = false;

function ensureModel() {
  if (initialized) return model;
  initialized = true;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[chat] GEMINI_API_KEY not set. AI chat disabled.");
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: buildSystemInstruction(),
    generationConfig: { maxOutputTokens: 600 },
  });
  console.log("[chat] Gemini model ready");
  return model;
}

// --- Channel-based chat history ---
const MAX_HISTORY = 40;
const channelHistories = new Map();

function getHistory(channelId) {
  if (!channelHistories.has(channelId)) channelHistories.set(channelId, []);
  return channelHistories.get(channelId);
}

/**
 * Add a message to channel history (both user messages and bot replies).
 * Called for ALL messages in the channel, not just bot-directed ones.
 */
export function addContext(channelId, displayName, text) {
  const history = getHistory(channelId);
  history.push({ role: "user", parts: [{ text: `[${displayName}] ${text}` }] });
  // Keep history bounded — remove oldest pair
  if (history.length > MAX_HISTORY) {
    history.splice(0, 1);
  }
}

// --- Gather extra context (web search, URL fetch) ---
async function gatherContext(text) {
  const extras = [];

  // 1. URL이 포함되어 있으면 내용 가져오기
  const urls = extractUrls(text);
  for (const url of urls.slice(0, 2)) {
    const content = await fetchUrl(url);
    if (content) {
      extras.push(`[URL 내용: ${url}]\n${content}`);
    }
  }

  // 2. 검색이 필요한 질문이면 웹검색
  if (needsSearch(text) && urls.length === 0) {
    // 검색 쿼리에서 봇 이름 제거
    const query = text.replace(/다오랑|오랑아?|@\S+/g, "").trim();
    if (query.length > 2) {
      const searchResult = await webSearch(query);
      if (searchResult) {
        extras.push(`[웹 검색 결과]\n${searchResult}`);
      }
    }
  }

  return extras.length > 0 ? "\n\n" + extras.join("\n\n") : "";
}

// --- Public API ---
export async function chat(channelId, displayName, text) {
  const m = ensureModel();
  if (!m) return null;

  // Gather web search / URL context
  const extraContext = await gatherContext(text);

  const history = getHistory(channelId);

  try {
    const pastHistory = history.slice(0, -1);
    const lastMsg = history[history.length - 1];

    // Append extra context to the message if available
    const messageText = extraContext
      ? `${lastMsg.parts[0].text}\n${extraContext}`
      : lastMsg.parts[0].text;

    const chatSession = m.startChat({ history: pastHistory });
    const result = await chatSession.sendMessage(messageText);
    const reply = result.response.text().trim();

    // Add bot reply to channel history
    history.push({ role: "model", parts: [{ text: reply }] });
    if (history.length > MAX_HISTORY) {
      history.splice(0, 1);
    }

    console.log(
      `[chat] #${channelId} ${displayName}: "${text.slice(0, 40)}" → "${reply.slice(0, 80)}"`
    );
    return reply;
  } catch (err) {
    console.error("[chat] Gemini error:", err.message);
    return "앗, 지금 잠깐 답변이 어려워요. 다시 물어봐 주세요!";
  }
}

export function isEnabled() {
  return ensureModel() !== null;
}

/**
 * knowledge 파일 리로드 + 모델 재초기화
 * @returns {number} 로드된 파일 수
 */
export function reloadKnowledge() {
  knowledge = loadKnowledge();
  initialized = false;
  model = null;
  return Object.keys(knowledge).length;
}

/**
 * 전체 히스토리 메시지 수 반환
 */
export function getHistorySize() {
  let total = 0;
  for (const history of channelHistories.values()) {
    total += history.length;
  }
  return total;
}
