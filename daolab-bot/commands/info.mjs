import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("info")
  .setDescription("서버 정보 확인");

export async function execute(interaction) {
  const { guild } = interaction;
  if (!guild) {
    await interaction.reply("서버에서만 사용할 수 있어요.");
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(guild.name)
    .setColor(0x5865f2)
    .addFields(
      { name: "멤버 수", value: `${guild.memberCount}명`, inline: true },
      {
        name: "채널 수",
        value: `${guild.channels.cache.size}개`,
        inline: true,
      },
      {
        name: "생성일",
        value: guild.createdAt.toLocaleDateString("ko-KR"),
        inline: true,
      }
    )
    .setTimestamp();

  if (guild.iconURL()) {
    embed.setThumbnail(guild.iconURL());
  }

  await interaction.reply({ embeds: [embed] });
}
