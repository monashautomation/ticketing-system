import { Client, Events, GatewayIntentBits, Interaction } from 'discord.js';
import { env } from './env';
import * as ticketCommand from './commands/ticket';
import * as linkCommand from './commands/link';

const commands = new Map([
  [ticketCommand.data.name, ticketCommand],
  [linkCommand.data.name, linkCommand],
]);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isModalSubmit() && ticketCommand.isTicketModalSubmit(interaction)) {
      await ticketCommand.handleModalSubmit(interaction);
    }
  } catch (error) {
    console.error('Interaction handling failed', error);
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(env.discordToken);
