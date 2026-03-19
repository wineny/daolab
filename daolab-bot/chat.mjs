import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { webSearch, fetchUrl, extractUrls, needsSearch } from "./tools.mjs";
import { loadMemoryContext } from "./memory.mjs";
import { loadLearningsContext } from "./learnings.mjs";
import { KNOWLEDGE_DIR } from "./config.mjs";

// --- Load knowledge files ---
function loadKnowledge() {
  const files = {};
  try {
    for (const f of readdirSync(KNOWLEDGE_DIR).filter((f) =>
      f.endsWith(".md")
    )) {
      files[f] = readFileSync(resolve(KNOWLEDGE_DIR, f), "utf8");
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
  const learningsText = loadLearningsContext();

  const instruction = [
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
    "",
    learningsText,
  ].join("\n");

  console.log(`[chat] System prompt: ${instruction.length} chars`);
  return instruction;
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
const COMPRESS_THRESHOLD = 30;
const COMPRESS_KEEP = 10;
const channelHistories = new Map();

function getHistory(channelId) {
  if (!channelHistories.has(channelId)) channelHistories.set(channelId, []);
  return channelHistories.get(channelId);
}

/**
 * 스레드 첫 메시지 시 부모 채널 최근 맥락 시딩 (bbojjak #15)
 * 스레드가 부모 채널 대화에서 분기된 맥락을 유지
 */
export function seedThread(threadId, threadName, parentChannelId) {
  if (channelHistories.has(threadId)) return; // 이미 히스토리 있음

  const parentHistory = channelHistories.get(parentChannelId);
  if (!parentHistory || parentHistory.length === 0) return;

  // 부모 채널 최근 5개 메시지로 맥락 시딩
  const recent = parentHistory
    .slice(-5)
    .map((h) => h.parts[0].text)
    .join("\n");

  channelHistories.set(threadId, [
    {
      role: "user",
      parts: [{ text: `[스레드 "${threadName}" — 부모 채널 맥락]\n${recent}` }],
    },
  ]);
  console.log(`[chat] Thread seeded: "${threadName}" ← parent #${parentChannelId}`);
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

/**
 * 히스토리 30개 초과 시 오래된 대화를 요약으로 압축 (bbojjak 레슨 #16)
 */
async function compressHistory(channelId) {
  const history = getHistory(channelId);
  if (history.length <= COMPRESS_THRESHOLD) return;

  const m = ensureModel();
  if (!m) return;

  // 압축할 오래된 메시지 분리
  const toCompress = history.splice(0, history.length - COMPRESS_KEEP);
  const conversationText = toCompress
    .map((h) => `${h.role === "model" ? "봇" : "멤버"}: ${h.parts[0].text}`)
    .join("\n");

  try {
    const result = await m.generateContent(
      `아래 디스코드 대화를 핵심 맥락 3줄로 요약해. 이름, 주요 화제, 결론만:\n\n${conversationText}`
    );
    const summary = result.response.text().trim();

    // 요약을 히스토리 맨 앞에 삽입
    history.unshift({
      role: "user",
      parts: [{ text: `[이전 대화 요약] ${summary}` }],
    });

    console.log(
      `[chat] Compressed ${toCompress.length} msgs → summary for #${channelId}`
    );
  } catch (err) {
    console.error("[chat] Compression failed:", err.message);
    // 실패 시 원래 메시지 복원
    history.unshift(...toCompress);
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

  // 히스토리 압축 (30개 초과 시)
  await compressHistory(channelId);

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
