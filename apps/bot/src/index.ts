import { Client, Events, GatewayIntentBits, Interaction } from 'discord.js';
import { env } from './env';
import * as ticketCommand from './commands/ticket';
import { syncAuthentikDirectory } from './api-client';
import { processPendingDiscordDms } from './discord-dms';

const AUTHENTIK_SYNC_INTERVAL_MS = 1000 * 60 * 15;
const DISCORD_DM_POLL_INTERVAL_MS = 1000 * 30;

const commands = new Map([[ticketCommand.data.name, ticketCommand]]);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  // Started only once login succeeds -- sending DMs needs the live gateway connection.
  setInterval(() => {
    processPendingDiscordDms(readyClient).catch((error) =>
      console.error('Discord DM poll failed', error),
    );
  }, DISCORD_DM_POLL_INTERVAL_MS);
});

// Independent of Discord login succeeding -- a bad Discord token must not block the
// Authentik directory sync that CC/assignee pickers depend on.
syncAuthentikDirectory().catch((error) => console.error('Authentik directory sync failed', error));
setInterval(() => {
  syncAuthentikDirectory().catch((error) => console.error('Authentik directory sync failed', error));
}, AUTHENTIK_SYNC_INTERVAL_MS);

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

client.login(env.discordToken).catch((error) => {
  console.error('Discord login failed -- ticket-bot commands are unavailable, but Authentik sync continues', error);
});
