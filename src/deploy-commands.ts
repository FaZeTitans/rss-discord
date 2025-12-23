import { REST, Routes } from 'discord.js';

import * as subscribe from './commands/subscribe.ts';
import * as list from './commands/list.ts';
import * as unsubscribe from './commands/unsubscribe.ts';
import * as edit from './commands/edit.ts';
import * as test from './commands/test.ts';
import * as pause from './commands/pause.ts';
import * as resume from './commands/resume.ts';
import * as status from './commands/status.ts';
import * as exportCmd from './commands/export.ts';
import * as importCmd from './commands/import.ts';
import * as settings from './commands/settings.ts';
import * as stats from './commands/stats.ts';
import * as youtube from './commands/youtube.ts';
import * as reddit from './commands/reddit.ts';
import * as webhook from './commands/webhook.ts';
import * as botstats from './commands/botstats.ts';
import * as cleanup from './commands/cleanup.ts';

const commands = [
	subscribe.data.toJSON(),
	list.data.toJSON(),
	unsubscribe.data.toJSON(),
	edit.data.toJSON(),
	test.data.toJSON(),
	pause.data.toJSON(),
	resume.data.toJSON(),
	status.data.toJSON(),
	exportCmd.data.toJSON(),
	importCmd.data.toJSON(),
	settings.data.toJSON(),
	stats.data.toJSON(),
	youtube.data.toJSON(),
	reddit.data.toJSON(),
	webhook.data.toJSON(),
	botstats.data.toJSON(),
	cleanup.data.toJSON(),
];

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
	console.error('❌ DISCORD_TOKEN and DISCORD_CLIENT_ID must be set');
	process.exit(1);
}

const rest = new REST().setToken(token);

console.log(`🔄 Deploying ${commands.length} slash commands...`);

try {
	if (guildId) {
		// Guild commands update instantly (for development)
		await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
			body: commands,
		});
		console.log(`✅ Deployed to guild ${guildId} (instant update)`);
	} else {
		// Global commands take up to 1h to propagate
		await rest.put(Routes.applicationCommands(clientId), { body: commands });
		console.log('✅ Deployed globally (may take up to 1h to update)');
	}
} catch (error) {
	console.error('❌ Failed to deploy commands:', error);
	process.exit(1);
}
