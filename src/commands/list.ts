import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
	MessageFlags,
} from 'discord.js';
import { getSubscriptions, getCategories } from '../database.ts';

export const data = new SlashCommandBuilder()
	.setName('list')
	.setDescription('List all RSS feed subscriptions for this server')
	.addStringOption((option) =>
		option
			.setName('category')
			.setDescription('Filter by category')
			.setRequired(false),
	);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const categoryFilter = interaction.options.getString('category');
	let subscriptions = getSubscriptions(interaction.guildId!);

	if (categoryFilter) {
		subscriptions = subscriptions.filter((s) => s.category === categoryFilter);
	}

	if (subscriptions.length === 0) {
		const categories = getCategories(interaction.guildId!);
		let content = '📭 No RSS feed subscriptions';
		if (categoryFilter) {
			content += ` in category \`${categoryFilter}\``;
		}
		content += '. Use `/subscribe` to add one!';

		if (categories.length > 0 && !categoryFilter) {
			content += `\n\n📁 Available categories: ${categories.map((c) => `\`${c}\``).join(', ')}`;
		}

		await interaction.reply({
			content,
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const embed = new EmbedBuilder()
		.setColor(0x3498db)
		.setTitle(
			categoryFilter
				? `📰 RSS Feeds - ${categoryFilter}`
				: '📰 RSS Feed Subscriptions',
		)
		.setDescription(
			subscriptions
				.map((sub) => {
					const statusIcon = sub.paused
						? '⏸️'
						: sub.error_count > 0
							? '⚠️'
							: '✅';

					let text = `${statusIcon} **#${sub.id}** - ${sub.feed_name || sub.feed_url}\n`;
					text += `↳ <#${sub.channel_id}>`;

					const badges: string[] = [];
					if (sub.role_id) badges.push(`@mention`);
					if (sub.color) badges.push(`#${sub.color}`);
					if (sub.category && !categoryFilter)
						badges.push(`📁 ${sub.category}`);
					if (sub.include_keywords) badges.push(`🔍 filter`);
					if (sub.max_posts_per_hour)
						badges.push(`⏱️ ${sub.max_posts_per_hour}/h`);

					if (badges.length > 0) {
						text += ` • ${badges.join(' • ')}`;
					}

					return text;
				})
				.join('\n\n'),
		)
		.setFooter({
			text: `${subscriptions.length} subscription${subscriptions.length > 1 ? 's' : ''} total`,
		})
		.setTimestamp();

	// Add category list if not filtering
	if (!categoryFilter) {
		const categories = getCategories(interaction.guildId!);
		if (categories.length > 0) {
			embed.addFields({
				name: '📁 Categories',
				value: categories.map((c) => `\`${c}\``).join(', '),
			});
		}
	}

	await interaction.reply({ embeds: [embed] });
}
