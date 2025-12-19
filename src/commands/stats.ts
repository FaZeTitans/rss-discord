import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
} from 'discord.js';
import { getPostStats, getSubscriptions } from '../database.ts';

export const data = new SlashCommandBuilder()
	.setName('stats')
	.setDescription('Show RSS feed statistics')
	.addIntegerOption((option) =>
		option
			.setName('days')
			.setDescription('Number of days to analyze (default: 7)')
			.setMinValue(1)
			.setMaxValue(30),
	);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const days = interaction.options.getInteger('days') ?? 7;
	const stats = getPostStats(interaction.guildId!, days);
	const subs = getSubscriptions(interaction.guildId!);

	const activeSubs = subs.filter((s) => !s.paused).length;
	const pausedSubs = subs.filter((s) => s.paused).length;
	const errorSubs = subs.filter((s) => s.error_count > 0).length;

	const embed = new EmbedBuilder()
		.setColor(0x3498db)
		.setTitle(`📊 RSS Statistics (Last ${days} days)`)
		.addFields(
			{
				name: '📨 Total Posts',
				value: stats.total.toString(),
				inline: true,
			},
			{
				name: '📰 Active Feeds',
				value: activeSubs.toString(),
				inline: true,
			},
			{
				name: '⏸️ Paused',
				value: pausedSubs.toString(),
				inline: true,
			},
		);

	if (errorSubs > 0) {
		embed.addFields({
			name: '⚠️ Feeds with Errors',
			value: errorSubs.toString(),
			inline: true,
		});
	}

	// Top feeds by posts
	const topFeeds = stats.bySubscription.filter((s) => s.count > 0).slice(0, 5);

	if (topFeeds.length > 0) {
		embed.addFields({
			name: '🏆 Most Active Feeds',
			value: topFeeds
				.map(
					(f, i) => `${i + 1}. **${truncate(f.name, 30)}** - ${f.count} posts`,
				)
				.join('\n'),
		});
	}

	// Posts by day
	if (stats.byDay.length > 0) {
		const chart = stats.byDay
			.slice(0, 7)
			.map((d) => {
				const bar = '█'.repeat(Math.min(Math.ceil(d.count / 2), 20));
				// Convert YYYY-MM-DD to dd/mm
				const [, month, day] = d.date.split('-');
				return `\`${day}/${month}\` ${bar} ${d.count}`;
			})
			.join('\n');

		embed.addFields({
			name: '📅 Posts by Day',
			value: chart || 'No data',
		});
	}

	embed.setFooter({ text: `Tracking ${subs.length} feeds total` });
	embed.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}

function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 3) + '...';
}
