// --- Config: 공유 상수 (단일 정의) ---
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ADMIN_ID = "925580658917646397";
export const MEMORY_DIR = resolve(__dirname, "memory");
export const KNOWLEDGE_DIR = resolve(__dirname, "..", "knowledge");
export const PROGRAM_START = new Date("2026-03-10");

// .env에서 로드됨 — 함수로 지연 접근 (bot.mjs에서 .env 파싱 후 호출)
export function getDigestChannelId() {
  return process.env.DIGEST_CHANNEL_ID || "1484166024923316344";
}
