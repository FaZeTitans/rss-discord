import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	MessageFlags,
} from 'discord.js';
import { getSubscriptionById, updateSubscription } from '../database.ts';

export const data = new SlashCommandBuilder()
	.setName('edit')
	.setDescription('Edit an existing RSS subscription')
	.addIntegerOption((option) =>
		option
			.setName('id')
			.setDescription('The subscription ID (use /list to see IDs)')
			.setRequired(true),
	)
	.addStringOption((option) =>
		option.setName('name').setDescription('New name for the feed'),
	)
	.addStringOption((option) =>
		option
			.setName('color')
			.setDescription('New embed color (hex format, e.g., #FF5733)'),
	)
	.addRoleOption((option) =>
		option
			.setName('role')
			.setDescription('Role to mention (leave empty to remove)'),
	)
	.addStringOption((option) =>
		option.setName('category').setDescription('Category for organizing feeds'),
	)
	.addStringOption((option) =>
		option
			.setName('include_keywords')
			.setDescription(
				'Only post if title/content contains these words (comma-separated)',
			),
	)
	.addStringOption((option) =>
		option
			.setName('exclude_keywords')
			.setDescription('Skip posts containing these words (comma-separated)'),
	)
	.addIntegerOption((option) =>
		option
			.setName('max_posts_per_hour')
			.setDescription('Maximum posts per hour (0 to disable)')
			.setMinValue(0)
			.setMaxValue(60),
	)
	.addBooleanOption((option) =>
		option
			.setName('use_regex')
			.setDescription('Treat keywords as regular expressions'),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const id = interaction.options.getInteger('id', true);
	const sub = getSubscriptionById(id);

	if (!sub || sub.guild_id !== interaction.guildId) {
		await interaction.reply({
			content: '❌ Subscription not found.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const updates: Record<string, unknown> = {};

	const name = interaction.options.getString('name');
	if (name !== null) updates.feed_name = name;

	const color = interaction.options.getString('color');
	if (color !== null) {
		if (!/^#?[0-9A-Fa-f]{6}$/.test(color)) {
			await interaction.reply({
				content: '❌ Invalid color format. Use hex format like `#FF5733`.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		updates.color = color.replace('#', '');
	}

	const role = interaction.options.getRole('role');
	if (role !== null) updates.role_id = role.id;

	const category = interaction.options.getString('category');
	if (category !== null) updates.category = category || null;

	const includeKeywords = interaction.options.getString('include_keywords');
	if (includeKeywords !== null)
		updates.include_keywords = includeKeywords || null;

	const excludeKeywords = interaction.options.getString('exclude_keywords');
	if (excludeKeywords !== null)
		updates.exclude_keywords = excludeKeywords || null;

	const maxPosts = interaction.options.getInteger('max_posts_per_hour');
	if (maxPosts !== null) updates.max_posts_per_hour = maxPosts || null;

	const useRegex = interaction.options.getBoolean('use_regex');
	if (useRegex !== null) updates.use_regex = useRegex ? 1 : 0;

	if (Object.keys(updates).length === 0) {
		await interaction.reply({
			content: '❌ No changes specified.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	updateSubscription(id, updates);

	const changes = Object.entries(updates)
		.map(([key, value]) => `• **${key}**: ${value ?? 'removed'}`)
		.join('\n');

	await interaction.reply({
		content: `✅ Updated subscription #${id}:\n${changes}`,
	});
}
