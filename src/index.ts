import {
	ActivityType,
	Client,
	Collection,
	Events,
	GatewayIntentBits,
	MessageFlags,
} from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { checkFeeds } from './rss.ts';
import { cleanOldHistory } from './database.ts';

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

// Check interval: 30s in development, 5min in production
const isDev = process.env.NODE_ENV !== 'production';
const CHECK_INTERVAL = isDev ? 30 * 1000 : 5 * 60 * 1000;
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const HISTORY_RETENTION_DAYS = 30;

// Flag to prevent concurrent feed checks
let isCheckingFeeds = false;
let isShuttingDown = false;

// Wait for in-progress feed checks to complete before shutdown
async function gracefulShutdown(signal: string): Promise<void> {
	if (isShuttingDown) return;
	isShuttingDown = true;

	console.log(`📴 Received ${signal}, shutting down gracefully...`);

	if (isCheckingFeeds) {
		console.log('⏳ Waiting for feed check to complete...');
		// Wait up to 30 seconds for the check to complete
		const maxWait = 30000;
		const checkInterval = 100;
		let waited = 0;
		while (isCheckingFeeds && waited < maxWait) {
			await new Promise((resolve) => setTimeout(resolve, checkInterval));
			waited += checkInterval;
		}
		if (isCheckingFeeds) {
			console.log('⚠️ Feed check did not complete in time, forcing shutdown...');
		} else {
			console.log('✅ Feed check completed');
		}
	}

	client.destroy();
	process.exit(0);
}

interface Command {
	data: { name: string };
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const client = new Client({
	intents: [GatewayIntentBits.Guilds],
});

const commands = new Collection<string, Command>();
commands.set(subscribe.data.name, subscribe);
commands.set(list.data.name, list);
commands.set(unsubscribe.data.name, unsubscribe);
commands.set(edit.data.name, edit);
commands.set(test.data.name, test);
commands.set(pause.data.name, pause);
commands.set(resume.data.name, resume);
commands.set(status.data.name, status);
commands.set(exportCmd.data.name, exportCmd);
commands.set(importCmd.data.name, importCmd);
commands.set(settings.data.name, settings);
commands.set(stats.data.name, stats);
commands.set(youtube.data.name, youtube);
commands.set(reddit.data.name, reddit);
commands.set(webhook.data.name, webhook);
commands.set(botstats.data.name, botstats);

client.once(Events.ClientReady, (readyClient) => {
	console.log(`✅ Logged in as ${readyClient.user.tag}`);
	console.log(
		`📡 Check interval: ${CHECK_INTERVAL / 1000}s (${isDev ? 'dev' : 'prod'} mode)`,
	);

	// Set bot status
	readyClient.user.setActivity('your feeds', { type: ActivityType.Watching });

	// Clean old history on startup
	const cleaned = cleanOldHistory(HISTORY_RETENTION_DAYS);
	if (cleaned > 0) {
		console.log(`🧹 Cleaned ${cleaned} old history entries`);
	}

	// Schedule periodic history cleanup (every 24 hours)
	setInterval(() => {
		const count = cleanOldHistory(HISTORY_RETENTION_DAYS);
		if (count > 0) {
			console.log(`🧹 Cleaned ${count} old history entries`);
		}
	}, CLEANUP_INTERVAL);

	// Start checking feeds periodically with concurrency protection
	setInterval(async () => {
		if (isCheckingFeeds) {
			console.log('⏳ Previous feed check still running, skipping...');
			return;
		}
		isCheckingFeeds = true;
		try {
			await checkFeeds(client);
		} finally {
			isCheckingFeeds = false;
		}
	}, CHECK_INTERVAL);

	// Initial check
	checkFeeds(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const command = commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		const content = '❌ There was an error while executing this command!';

		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
		} else {
			await interaction.reply({ content, flags: MessageFlags.Ephemeral });
		}
	}
});

const token = process.env.DISCORD_TOKEN;

if (!token) {
	console.error('❌ DISCORD_TOKEN is not set in environment variables');
	process.exit(1);
}

// Graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

client.login(token);
