import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("hello")
  .setDescription("DaoLab 봇이 인사해요");

export async function execute(interaction) {
  await interaction.reply(
    `안녕하세요 ${interaction.user.displayName}! DaoLab 봇이에요 👋`
  );
}
