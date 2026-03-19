// --- History: 봇 재시작 시 채널별 최근 메시지 복원 ---
import { ChannelType } from "discord.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 봇이 접속한 모든 길드의 텍스트 채널에서 최근 메시지를 복원
 * @param {import("discord.js").Client} client
 * @param {Function} addContextFn - chat.mjs의 addContext 함수
 * @param {number} limit - 채널당 가져올 메시지 수
 * @returns {Promise<number>} 복원된 메시지 수
 */
export async function restoreAll(client, addContextFn, limit = 20) {
  let restoredCount = 0;
  let channelCount = 0;

  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      // 텍스트 채널만 (GuildText = 0)
      if (channel.type !== ChannelType.GuildText) continue;

      try {
        const messages = await channel.messages.fetch({ limit });
        // Discord는 최신순 반환 → 시간순 정렬 (오래된 것 먼저)
        const sorted = [...messages.values()].reverse();

        for (const msg of sorted) {
          // 봇 자신의 메시지는 건너뛰기
          if (msg.author.id === client.user.id) continue;
          // 다른 봇 메시지도 건너뛰기
          if (msg.author.bot) continue;
          // 빈 메시지 건너뛰기
          if (!msg.content) continue;

          const displayName =
            msg.member?.displayName || msg.author.displayName;
          addContextFn(channel.id, displayName, msg.content);
          restoredCount++;
        }

        channelCount++;
        // Rate limit 방지: 채널 간 100ms 대기
        await sleep(100);
      } catch (err) {
        // 권한 없는 채널 등 → 조용히 건너뛰기
        if (err.code !== 50001) {
          // 50001 = Missing Access (일반적)
          console.warn(
            `[history] Skip #${channel.name}: ${err.message}`
          );
        }
      }
    }
  }

  // Active thread 복원 (bbojjak #15 — 스레드별 분리 세션)
  for (const guild of client.guilds.cache.values()) {
    try {
      const { threads } = await guild.channels.fetchActiveThreads();
      for (const thread of threads.values()) {
        try {
          const messages = await thread.messages.fetch({ limit });
          const sorted = [...messages.values()].reverse();

          for (const msg of sorted) {
            if (msg.author.bot || !msg.content) continue;
            const name = msg.member?.displayName || msg.author.displayName;
            addContextFn(thread.id, name, msg.content);
            restoredCount++;
          }

          channelCount++;
          await sleep(100);
        } catch (err) {
          if (err.code !== 50001) {
            console.warn(`[history] Skip thread #${thread.name}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.warn(`[history] Thread fetch failed: ${err.message}`);
    }
  }

  console.log(
    `[history] Restored ${restoredCount} messages from ${channelCount} channels+threads`
  );
  return restoredCount;
}
