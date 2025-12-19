import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
	MessageFlags,
} from 'discord.js';
import { getSubscriptionById, getSubscriptions } from '../database.ts';

export const data = new SlashCommandBuilder()
	.setName('status')
	.setDescription('Show the health status of RSS feeds')
	.addIntegerOption((option) =>
		option
			.setName('id')
			.setDescription('Show status for a specific subscription'),
	);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const id = interaction.options.getInteger('id');

	if (id !== null) {
		const sub = getSubscriptionById(id);

		if (!sub || sub.guild_id !== interaction.guildId) {
			await interaction.reply({
				content: '❌ Subscription not found.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const statusEmoji = sub.paused ? '⏸️' : sub.error_count > 0 ? '⚠️' : '✅';
		const status = sub.paused
			? 'Paused'
			: sub.error_count > 0
				? `${sub.error_count} errors`
				: 'Healthy';

		const embed = new EmbedBuilder()
			.setColor(
				sub.paused ? 0x808080 : sub.error_count > 0 ? 0xff9800 : 0x4caf50,
			)
			.setTitle(`${statusEmoji} ${sub.feed_name || sub.feed_url}`)
			.addFields(
				{ name: 'Status', value: status, inline: true },
				{ name: 'Channel', value: `<#${sub.channel_id}>`, inline: true },
				{
					name: 'Last Check',
					value: sub.last_check_at || 'Never',
					inline: true,
				},
			);

		if (sub.last_error) {
			embed.addFields({ name: 'Last Error', value: sub.last_error });
		}

		if (sub.max_posts_per_hour) {
			embed.addFields({
				name: 'Rate Limit',
				value: `${sub.posts_this_hour}/${sub.max_posts_per_hour} posts this hour`,
				inline: true,
			});
		}

		if (sub.include_keywords) {
			embed.addFields({
				name: 'Include Keywords',
				value: sub.include_keywords,
				inline: true,
			});
		}

		if (sub.exclude_keywords) {
			embed.addFields({
				name: 'Exclude Keywords',
				value: sub.exclude_keywords,
				inline: true,
			});
		}

		await interaction.reply({ embeds: [embed] });
		return;
	}

	// Show overview of all feeds
	const subs = getSubscriptions(interaction.guildId!);

	if (subs.length === 0) {
		await interaction.reply({
			content: '📭 No RSS feed subscriptions yet.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const healthy = subs.filter((s) => !s.paused && s.error_count === 0).length;
	const paused = subs.filter((s) => s.paused).length;
	const errors = subs.filter((s) => !s.paused && s.error_count > 0).length;

	const embed = new EmbedBuilder()
		.setColor(errors > 0 ? 0xff9800 : 0x4caf50)
		.setTitle('📊 Feed Status Overview')
		.addFields(
			{ name: '✅ Healthy', value: healthy.toString(), inline: true },
			{ name: '⏸️ Paused', value: paused.toString(), inline: true },
			{ name: '⚠️ Errors', value: errors.toString(), inline: true },
		);

	if (errors > 0) {
		const errorFeeds = subs
			.filter((s) => !s.paused && s.error_count > 0)
			.map(
				(s) =>
					`• #${s.id} ${s.feed_name || s.feed_url} (${s.error_count} errors)`,
			)
			.join('\n');
		embed.addFields({ name: 'Feeds with Errors', value: errorFeeds });
	}

	await interaction.reply({ embeds: [embed] });
}
