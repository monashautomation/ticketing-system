import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { redeemLinkCode } from '../api-client';

export const data = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Link your Discord account to your support account')
  .addStringOption((option) =>
    option
      .setName('code')
      .setDescription('The code shown on the /settings/link-discord page')
      .setRequired(true)
      .setMinLength(8)
      .setMaxLength(8),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const code = interaction.options.getString('code', true).toUpperCase();

  try {
    const result = await redeemLinkCode(code, interaction.user.id);
    await interaction.editReply(`Linked! Your Discord account is now connected to ${result.name}.`);
  } catch (error) {
    await interaction.editReply(
      `Couldn't link your account: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}
