// --- Admin: 관리자 전용 기능 ---
import * as memory from "./memory.mjs";
import { reloadKnowledge, getHistorySize } from "./chat.mjs";
import { weeklyDigest, heartbeat } from "./scheduler.mjs";
import { listLearnings } from "./learnings.mjs";
import { getSecurityStats } from "./security.mjs";
import { ADMIN_ID } from "./config.mjs";

const BOT_START_TIME = Date.now();

/**
 * /admin 슬래시 커맨드 핸들러
 */
export async function handleAdmin(interaction) {
  // 관리자 검증 (최우선)
  if (interaction.user.id !== ADMIN_ID) {
    await interaction.reply({
      content: "관리자 전용 명령어예요! 🔒",
      ephemeral: true,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case "reload":
      await handleReload(interaction);
      break;
    case "memory":
      await handleMemory(interaction);
      break;
    case "status":
      await handleStatus(interaction);
      break;
    case "digest":
      await handleDigest(interaction);
      break;
    case "learnings":
      await handleLearnings(interaction);
      break;
    case "heartbeat":
      await handleHeartbeat(interaction);
      break;
    case "security":
      await handleSecurity(interaction);
      break;
    default:
      await interaction.reply({
        content: "알 수 없는 명령어예요!",
        ephemeral: true,
      });
  }
}

async function handleReload(interaction) {
  const count = reloadKnowledge();
  await interaction.reply({
    content: `knowledge ${count}개 파일 리로드 완료! ✅`,
    ephemeral: true,
  });
}

async function handleMemory(interaction) {
  const summary = memory.list();
  await interaction.reply({
    content: summary.length > 1900 ? summary.slice(0, 1900) + "..." : summary,
    ephemeral: true,
  });
}

async function handleStatus(interaction) {
  const uptimeMs = Date.now() - BOT_START_TIME;
  const hours = Math.floor(uptimeMs / 3600000);
  const minutes = Math.floor((uptimeMs % 3600000) / 60000);
  const guilds = interaction.client.guilds.cache.size;
  const channels = interaction.client.channels.cache.size;
  const historySize = getHistorySize();

  const status = [
    "📊 **봇 상태**",
    `- Uptime: ${hours}시간 ${minutes}분`,
    `- 서버: ${guilds}개`,
    `- 채널: ${channels}개`,
    `- 히스토리: ${historySize}개 메시지`,
    `- 버전: v6 (threads + security-log + learnings + compression + heartbeat)`,
  ].join("\n");

  await interaction.reply({ content: status, ephemeral: true });
}

async function handleDigest(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    await weeklyDigest(interaction.client);
    await interaction.editReply("주간 다이제스트 발송 완료! ✅");
  } catch (err) {
    await interaction.editReply(`다이제스트 발송 실패: ${err.message}`);
  }
}

async function handleLearnings(interaction) {
  const summary = listLearnings();
  await interaction.reply({
    content: summary.length > 1900 ? summary.slice(0, 1900) + "..." : summary,
    ephemeral: true,
  });
}

async function handleHeartbeat(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    await heartbeat(interaction.client);
    await interaction.editReply("Heartbeat 순찰 완료! ✅");
  } catch (err) {
    await interaction.editReply(`Heartbeat 실패: ${err.message}`);
  }
}

async function handleSecurity(interaction) {
  const stats = getSecurityStats();
  const lines = [
    "🛡️ **보안 현황**",
    `- 총 차단: ${stats.total}건`,
    `- 최근 24시간: ${stats.recent24h}건`,
  ];

  if (stats.last5.length > 0) {
    lines.push("", "📋 **최근 기록**");
    for (const entry of stats.last5) {
      lines.push(entry);
    }
  } else {
    lines.push("- 기록 없음 (공격 시도 0건)");
  }

  const msg = lines.join("\n");
  await interaction.reply({
    content: msg.length > 1900 ? msg.slice(0, 1900) + "..." : msg,
    ephemeral: true,
  });
}
