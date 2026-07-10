import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { createTicket } from '../api-client';

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Open a new support ticket');

const MODAL_ID = 'ticket-create-modal';
const TITLE_INPUT_ID = 'ticket-title';
const DESCRIPTION_INPUT_ID = 'ticket-description';

export async function execute(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder().setCustomId(MODAL_ID).setTitle('New Support Ticket');

  const titleInput = new TextInputBuilder()
    .setCustomId(TITLE_INPUT_ID)
    .setLabel('Title')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(200)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId(DESCRIPTION_INPUT_ID)
    .setLabel('Describe the issue')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(4000)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
  );

  await interaction.showModal(modal);
}

export function isTicketModalSubmit(interaction: ModalSubmitInteraction): boolean {
  return interaction.customId === MODAL_ID;
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const title = interaction.fields.getTextInputValue(TITLE_INPUT_ID);
  const description = interaction.fields.getTextInputValue(DESCRIPTION_INPUT_ID);

  try {
    const result = await createTicket({
      title,
      description,
      priority: 'normal',
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.username,
      discordChannelId: interaction.channelId ?? undefined,
    });

    await interaction.editReply(
      `Ticket created. Check your DMs for the link — or open it directly: ${result.url}`,
    );

    await interaction.user
      .send(`Your support ticket "${title}" was created: ${result.url}`)
      .catch(() => {
        // DMs closed — the ephemeral reply above already has the link, nothing further to do.
      });
  } catch (error) {
    await interaction.editReply(
      `Couldn't create your ticket: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}
