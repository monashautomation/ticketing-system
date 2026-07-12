import { Client, Events, GatewayIntentBits, Interaction } from 'discord.js';
import { env } from './env';
import { logger } from './logger';
import * as ticketCommand from './commands/ticket';
import { syncAuthentikDirectory } from './api-client';
import { processPendingDiscordDms } from './discord-dms';

const AUTHENTIK_SYNC_INTERVAL_MS = 1000 * 60 * 15;
const DISCORD_DM_POLL_INTERVAL_MS = 1000 * 30;

// Loud by design: a silent crash here just looks like "the bot isn't loading" with
// no clue why. Node would print these to stderr by default, but log this explicitly
// so it's unambiguous in aggregated logs which event killed the process.
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception -- bot process will exit', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection -- bot process will exit', reason);
  process.exit(1);
});

logger.info('Bot process starting', { nodeVersion: process.version, pid: process.pid });

const commands = new Map([[ticketCommand.data.name, ticketCommand]]);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

if (env.debugLogging) {
  client.on(Events.Debug, (message) => logger.info(`discord.js debug: ${message}`));
}
client.on(Events.Warn, (message) => logger.warn(`discord.js warn: ${message}`));
client.on(Events.Error, (error) => logger.error('discord.js client error', error));
client.on(Events.ShardDisconnect, (event, shardId) =>
  logger.warn('Discord shard disconnected', { shardId, code: event.code, reason: event.reason }),
);
client.on(Events.ShardReconnecting, (shardId) => logger.warn('Discord shard reconnecting', { shardId }));
client.on(Events.ShardResume, (shardId, replayedEvents) =>
  logger.info('Discord shard resumed', { shardId, replayedEvents }),
);

client.once(Events.ClientReady, (readyClient) => {
  logger.info(`Logged in as ${readyClient.user.tag}`, {
    guildCount: readyClient.guilds.cache.size,
    registeredCommands: [...commands.keys()],
  });

  // Started only once login succeeds -- sending DMs needs the live gateway connection.
  setInterval(() => {
    processPendingDiscordDms(readyClient).catch((error) =>
      logger.error('Discord DM poll failed', error),
    );
  }, DISCORD_DM_POLL_INTERVAL_MS);
});

// Independent of Discord login succeeding -- a bad Discord token must not block the
// Authentik directory sync that CC/assignee pickers depend on.
logger.info('Starting Authentik directory sync loop', { intervalMs: AUTHENTIK_SYNC_INTERVAL_MS });
syncAuthentikDirectory().catch((error) => logger.error('Authentik directory sync failed', error));
setInterval(() => {
  syncAuthentikDirectory().catch((error) => logger.error('Authentik directory sync failed', error));
}, AUTHENTIK_SYNC_INTERVAL_MS);

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) {
        logger.warn('Received unknown command', { commandName: interaction.commandName });
        return;
      }
      await command.execute(interaction);
      return;
    }

    if (interaction.isModalSubmit() && ticketCommand.isTicketModalSubmit(interaction)) {
      await ticketCommand.handleModalSubmit(interaction);
    }
  } catch (error) {
    logger.error('Interaction handling failed', error);
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => {});
    }
  }
});

logger.info('Logging in to Discord gateway…');
client.login(env.discordToken).catch((error) => {
  // discord.js throws distinct error codes for the common misconfigurations (bad
  // token, disallowed privileged intents) -- surface them instead of a bare stack.
  logger.error(
    `Discord login failed (${error?.code ?? 'unknown code'}) -- ticket-bot commands are unavailable, but Authentik sync continues`,
    error,
  );
});
