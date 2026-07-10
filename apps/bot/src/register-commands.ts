import { REST, Routes } from 'discord.js';
import { env } from './env';
import * as ticketCommand from './commands/ticket';
import * as linkCommand from './commands/link';

const commands = [ticketCommand.data.toJSON(), linkCommand.data.toJSON()];
const rest = new REST().setToken(env.discordToken);

async function main() {
  const route = env.discordDevGuildId
    ? Routes.applicationGuildCommands(env.discordClientId, env.discordDevGuildId)
    : Routes.applicationCommands(env.discordClientId);

  await rest.put(route, { body: commands });
  console.log(
    `Registered ${commands.length} slash commands${env.discordDevGuildId ? ' (guild scope)' : ' (global scope, may take up to 1h to propagate)'}`,
  );
}

main().catch((error) => {
  console.error('Failed to register commands', error);
  process.exit(1);
});
