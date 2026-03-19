import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { webSearch, fetchUrl, extractUrls, needsSearch } from "./tools.mjs";
import { loadMemoryContext } from "./memory.mjs";
import { loadLearningsContext } from "./learnings.mjs";
import { KNOWLEDGE_DIR } from "./config.mjs";
import { seedThread as _seedThread, compressHistory, addToHistory } from "./chat-utils.mjs";

// --- 반말 → 해요체 후처리 (Gemini가 해요체를 일관되게 안 따르는 문제 보완) ---
// 범용 패턴: 구두점(! . ? ~ \n) 앞의 반말 종결어미를 해요체로 변환
const BANMAL_RULES = [
  // 1. "~야" 계열 → "~예요" (이야, 거야, 뭐야 등)
  [/이야([!.?~\s]|$)/g, "이에요$1"],
  [/거야([!.?~\s]|$)/g, "거예요$1"],
  [/([가-힣])야([!.?~\s]|$)/g, "$1예요$2"],
  // 2. "~봐" 계열 → "~봐요"
  [/([가-힣])봐([!.?~\s]|$)/g, "$1봐요$2"],
  // 3. "~해" 계열 → "~해요"
  [/([가-힣])해([!?~\s]|$)/g, "$1해요$2"],
  // 4. "~어/~아" 종결 (가장 범용) → "~어요/~아요"
  // "~았어", "~었어", "~있어", "~없어", "~했어" 등 모두 커버
  [/([았었였겠]|있|없)어([!.?~\s]|$)/g, "$1어요$2"],
  // 5. "~지" 종결 → "~지요" (근데, 알지, 모르지 등)
  [/([가-힣])지([!.?~]|$)/g, "$1지요$2"],
  // 6. "~거든" → "~거든요"
  [/거든([!.?~\s]|$)/g, "거든요$1"],
  // 7. "~는데" → "~는데요" (문장 끝에서만)
  [/는데([!.?~]|$)/g, "는데요$1"],
  // 8. "어때" → "어때요" (제안/질문 시)
  [/어때([!?~\s]|$)/g, "어때요$1"],
  // 9. "~ㄹ까" → "~ㄹ까요"
  [/([가-힣])까([!?~\s]|$)/g, "$1까요$2"],
];

function toHeyoStyle(text) {
  let result = text;
  for (const [pattern, replacement] of BANMAL_RULES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

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

  // 08_crew_intro.md(245KB)는 시스템 프롬프트에서 제외 — 프롬프트가 너무 길면
  // Gemini가 말투 규칙 등 핵심 지시를 무시함. 크루 소개는 질문 시 별도 로드.
  const EXCLUDE_FROM_PROMPT = new Set(["SOUL.md", "AGENTS.md", "08_crew_intro.md"]);
  const knowledgeText = Object.entries(knowledge)
    .filter(([name]) => !EXCLUDE_FROM_PROMPT.has(name))
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
    "",
    `## [최종 리마인더] 말투 규칙 재확인 — 이 규칙이 다른 모든 규칙보다 우선`,
    `반드시 해요체로만 답변하세요. 모든 문장을 "~해요", "~이에요", "~있어요", "~할까요?", "~봐요", "~이죠" 형태로 끝내세요.`,
    `"~해", "~야", "~어", "~지", "~봐" 같은 반말 종결어미는 절대 사용 금지. 예외 없음.`,
    `(O) "5일 남았어요!" / (X) "5일 남았어!"`,
    `(O) "다오랩데이도 있어요" / (X) "다오랩데이도 있어"`,
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
const channelHistories = new Map();

/**
 * 스레드 첫 메시지 시 부모 채널 최근 맥락 시딩 (bbojjak #15)
 */
export function seedThread(threadId, threadName, parentChannelId) {
  _seedThread(threadId, threadName, parentChannelId, channelHistories);
}

/**
 * Add a message to channel history (both user messages and bot replies).
 * Called for ALL messages in the channel, not just bot-directed ones.
 */
export function addContext(channelId, displayName, text) {
  addToHistory(channelId, displayName, text, channelHistories, MAX_HISTORY);
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
  await compressHistory(channelId, channelHistories, m);

  // Gather web search / URL context
  const extraContext = await gatherContext(text);

  const history = channelHistories.get(channelId) || [];

  try {
    const pastHistory = history.slice(0, -1);
    const lastMsg = history[history.length - 1];

    // Append extra context to the message if available
    let messageText = extraContext
      ? `${lastMsg.parts[0].text}\n${extraContext}`
      : lastMsg.parts[0].text;

    // 해요체 강제 리마인더 — 매 메시지에 주입 (긴 시스템 프롬프트에서 규칙이 묻히는 것 방지)
    messageText += `\n\n[말투 리마인더: 해요체로만 답변. "~야","~어","~해","~봐" 금지. "~이에요","~해요","~있어요","~봐요" 사용.]`;

    const chatSession = m.startChat({ history: pastHistory });
    const result = await chatSession.sendMessage(messageText);
    const raw = result.response.text().trim();
    const reply = toHeyoStyle(raw);

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
    return "앗, 지금 잠깐 답변이 어려워요. 다시 물어봐주세요!";
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
