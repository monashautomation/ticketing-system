import { REST, Routes } from 'discord.js';
import { env } from './env';
import { logger } from './logger';
import * as ticketCommand from './commands/ticket';

const commands = [ticketCommand.data.toJSON()];
const rest = new REST().setToken(env.discordToken);

async function main() {
  const route = env.discordDevGuildId
    ? Routes.applicationGuildCommands(env.discordClientId, env.discordDevGuildId)
    : Routes.applicationCommands(env.discordClientId);

  await rest.put(route, { body: commands });
  logger.info(
    `Registered ${commands.length} slash commands${env.discordDevGuildId ? ' (guild scope)' : ' (global scope, may take up to 1h to propagate)'}`,
  );
}

main().catch((error) => {
  logger.error('Failed to register commands', error);
  process.exit(1);
});
