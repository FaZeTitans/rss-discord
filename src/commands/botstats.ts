import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
	version as djsVersion,
} from 'discord.js';
import { getAllSubscriptions, getActiveSubscriptions } from '../database.ts';

export const data = new SlashCommandBuilder()
	.setName('botstats')
	.setDescription('Show bot statistics');

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const client = interaction.client;

	// Get stats
	const guilds = client.guilds.cache.size;
	const users = client.guilds.cache.reduce(
		(acc, guild) => acc + guild.memberCount,
		0,
	);
	const allSubs = getAllSubscriptions();
	const activeSubs = getActiveSubscriptions();
	const pausedSubs = allSubs.length - activeSubs.length;

	// Calculate uptime
	const uptime = process.uptime();
	const days = Math.floor(uptime / 86400);
	const hours = Math.floor((uptime % 86400) / 3600);
	const minutes = Math.floor((uptime % 3600) / 60);
	const uptimeStr =
		days > 0
			? `${days}d ${hours}h ${minutes}m`
			: hours > 0
				? `${hours}h ${minutes}m`
				: `${minutes}m`;

	// Memory usage
	const memUsage = process.memoryUsage();
	const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);

	const embed = new EmbedBuilder()
		.setColor(0x5865f2)
		.setTitle('📊 Bot Statistics')
		.setThumbnail(client.user?.displayAvatarURL() || null)
		.addFields(
			{
				name: '🌐 Servers',
				value: guilds.toLocaleString(),
				inline: true,
			},
			{
				name: '👥 Users',
				value: users.toLocaleString(),
				inline: true,
			},
			{
				name: '📡 Subscriptions',
				value: `${activeSubs.length} active\n${pausedSubs} paused`,
				inline: true,
			},
			{
				name: '⏱️ Uptime',
				value: uptimeStr,
				inline: true,
			},
			{
				name: '💾 Memory',
				value: `${memMB} MB`,
				inline: true,
			},
			{
				name: '🔧 Version',
				value: `Bun ${Bun.version}\ndiscord.js ${djsVersion}`,
				inline: true,
			},
		)
		.setFooter({ text: 'RSS Discord Bot' })
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}
