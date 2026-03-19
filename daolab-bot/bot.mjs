import { Client, GatewayIntentBits, Collection, Events } from "discord.js";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chat, addContext, seedThread, isEnabled as isChatEnabled } from "./chat.mjs";
import { restoreAll } from "./history.mjs";
import { detect as detectMemory } from "./memory.mjs";
import { start as startScheduler } from "./scheduler.mjs";
import { checkInjection, logAttack } from "./security.mjs";
import { detectFeedback, recordLearning } from "./learnings.mjs";

// --- Load .env ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, ".env");
try {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn("[env] .env not found, using process env");
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is required. Set it in .env or environment.");
  process.exit(1);
}

// --- Client setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- Load commands ---
client.commands = new Collection();
const commandsPath = resolve(__dirname, "commands");
try {
  const commandFiles = readdirSync(commandsPath).filter((f) =>
    f.endsWith(".mjs")
  );
  for (const file of commandFiles) {
    const command = await import(`./commands/${file}`);
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`[cmd] Loaded: /${command.data.name}`);
    }
  }
} catch (err) {
  console.warn("[cmd] No commands directory or failed to load:", err.message);
}

// --- Interaction handler ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[cmd] Error in /${interaction.commandName}:`, error);
    const reply = {
      content: "명령어 실행 중 오류가 발생했어요.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// --- Message handler (channel-aware context) ---
const NAME_PATTERN = /다오랑|오랑/;

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const displayName =
    message.member?.displayName || message.author.displayName;

  // 스레드 컨텍스트 시딩 — 첫 메시지 시 부모 채널 맥락 주입 (bbojjak #15)
  if (message.channel.isThread?.()) {
    seedThread(message.channel.id, message.channel.name, message.channel.parentId);
  }

  // 모든 메시지를 채널 히스토리에 쌓음 (맥락 유지)
  addContext(message.channel.id, displayName, message.content);

  // "기억해줘" 패턴 감지 (멘션 없이도 작동)
  const memResult = detectMemory(message);
  if (memResult.detected && memResult.response) {
    await message.reply(memResult.response);
    // 기억하기만 하고 봇 호출이 아니면 여기서 종료
    const mentionedForMem = message.mentions.has(client.user);
    const nameCalledForMem = NAME_PATTERN.test(message.content);
    if (!mentionedForMem && !nameCalledForMem) return;
  }

  // 관리자 오류 피드백 감지 (봇 메시지에 대한 답글)
  if (message.reference && detectFeedback(message).detected) {
    try {
      const ref = await message.channel.messages.fetch(
        message.reference.messageId
      );
      if (ref.author.id === client.user.id) {
        const content = `봇: "${ref.content.slice(0, 100)}" → 수정: ${message.content}`;
        recordLearning(content, displayName);
        await message.reply("학습했어! 같은 실수 안 할게 ✅");
        return;
      }
    } catch {}
  }

  // 봇 @멘션 또는 이름 호출 시에만 응답
  const mentioned = message.mentions.has(client.user);
  const nameCalled = NAME_PATTERN.test(message.content);
  if (!mentioned && !nameCalled) return;

  // 프롬프트 인젝션 사전 차단 + 공격 로깅 (bbojjak #17 + #18)
  const injection = checkInjection(message.content);
  if (injection.blocked) {
    logAttack(message.author.id, displayName, message.channel.id, message.content, injection.label);
    await message.reply(
      "나는 다오랩 안내 봇이라 그런 건 답변할 수 없어! 다오랩에 대해 궁금한 거 물어봐!"
    );
    return;
  }

  if (!isChatEnabled()) {
    await message.reply("지금은 답변이 어려워요. 잠시 후에 다시 불러주세요!");
    return;
  }

  try {
    await message.channel.sendTyping();
    const reply = await chat(
      message.channel.id,
      displayName,
      message.content
    );
    if (reply) {
      const trimmed =
        reply.length > 1900 ? reply.slice(0, 1900) + "..." : reply;
      await message.reply(trimmed);
    }
  } catch (err) {
    console.error("[mention] Reply failed:", err.message);
  }
});

// --- Ready ---
client.once(Events.ClientReady, async (c) => {
  console.log(`[bot] Ready! Logged in as ${c.user.tag} (다오랑/오랑)`);
  console.log(`[bot] Serving ${c.guilds.cache.size} guild(s)`);

  // 히스토리 복원 (채널별 최근 메시지)
  try {
    const restored = await restoreAll(c, addContext);
    console.log(`[bot] History restored: ${restored} messages`);
  } catch (err) {
    console.error("[bot] History restore failed:", err.message);
  }

  // Cron 스케줄러 시작
  startScheduler(c);
});

// --- Graceful shutdown ---
process.on("SIGINT", () => {
  console.log("[bot] Shutting down...");
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[bot] Shutting down...");
  client.destroy();
  process.exit(0);
});

// --- Login ---
client.login(DISCORD_TOKEN);
