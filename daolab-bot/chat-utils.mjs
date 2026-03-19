// --- Chat Utilities: 히스토리 압축 + 스레드 시딩 ---

const COMPRESS_THRESHOLD = 30;
const COMPRESS_KEEP = 10;

/**
 * 스레드 첫 메시지 시 부모 채널 최근 맥락 시딩 (bbojjak #15)
 * 스레드가 부모 채널 대화에서 분기된 맥락을 유지
 */
export function seedThread(threadId, threadName, parentChannelId, channelHistories) {
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
 * 히스토리 30개 초과 시 오래된 대화를 요약으로 압축 (bbojjak 레슨 #16)
 */
export async function compressHistory(channelId, channelHistories, model) {
  const history = channelHistories.get(channelId);
  if (!history || history.length <= COMPRESS_THRESHOLD) return;

  if (!model) return;

  // 압축할 오래된 메시지 분리
  const toCompress = history.splice(0, history.length - COMPRESS_KEEP);
  const conversationText = toCompress
    .map((h) => `${h.role === "model" ? "봇" : "멤버"}: ${h.parts[0].text}`)
    .join("\n");

  try {
    const result = await model.generateContent(
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

/**
 * 채널 히스토리에 메시지 추가
 */
export function addToHistory(channelId, displayName, text, channelHistories, maxHistory) {
  if (!channelHistories.has(channelId)) channelHistories.set(channelId, []);
  const history = channelHistories.get(channelId);
  history.push({ role: "user", parts: [{ text: `[${displayName}] ${text}` }] });
  if (history.length > maxHistory) {
    history.splice(0, 1);
  }
}
