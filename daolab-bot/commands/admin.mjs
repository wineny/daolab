import { SlashCommandBuilder } from "discord.js";
import { handleAdmin } from "../admin.mjs";

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("관리자 전용 명령어")
  .addSubcommand((sub) =>
    sub.setName("reload").setDescription("knowledge 파일 리로드")
  )
  .addSubcommand((sub) =>
    sub.setName("memory").setDescription("메모리 현황 조회")
  )
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("봇 상태 확인")
  )
  .addSubcommand((sub) =>
    sub.setName("digest").setDescription("주간 다이제스트 수동 발송")
  );

export async function execute(interaction) {
  await handleAdmin(interaction);
}
