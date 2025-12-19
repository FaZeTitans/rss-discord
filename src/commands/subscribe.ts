import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
} from 'discord.js';
import { addSubscription } from '../database.ts';
import { parseFeed } from '../rss.ts';

export const data = new SlashCommandBuilder()
	.setName('subscribe')
	.setDescription('Subscribe to an RSS feed in the current channel')
	.addStringOption((option) =>
		option.setName('url').setDescription('The RSS feed URL').setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName('name')
			.setDescription('A custom name for this feed')
			.setRequired(false),
	)
	.addStringOption((option) =>
		option
			.setName('color')
			.setDescription('Embed color in hex format (e.g., #FF5733)')
			.setRequired(false),
	)
	.addRoleOption((option) =>
		option
			.setName('role')
			.setDescription('Role to mention when new posts arrive')
			.setRequired(false),
	)
	.addStringOption((option) =>
		option
			.setName('category')
			.setDescription('Category for organizing feeds')
			.setRequired(false),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const url = interaction.options.getString('url', true);
	const customName = interaction.options.getString('name');
	const color = interaction.options.getString('color');
	const role = interaction.options.getRole('role');
	const category = interaction.options.getString('category');

	await interaction.deferReply();

	// Validate color format
	if (color && !/^#?[0-9A-Fa-f]{6}$/.test(color)) {
		await interaction.editReply({
			content: '❌ Invalid color format. Use hex format like `#FF5733`.',
		});
		return;
	}

	// Validate the feed URL
	try {
		const feed = await parseFeed(url);
		const feedName = customName || feed.title || null;
		const normalizedColor = color?.replace('#', '') || null;

		const success = addSubscription(
			interaction.guildId!,
			interaction.channelId,
			url,
			feedName,
			normalizedColor,
			role?.id || null,
			category || null,
		);

		if (success) {
			let message = `✅ Subscribed to **${feedName || url}** in this channel.`;
			if (role) message += `\n📢 Will mention ${role} on new posts.`;
			if (color) message += `\n🎨 Embed color: \`${color}\``;
			if (category) message += `\n📁 Category: \`${category}\``;

			await interaction.editReply({ content: message });
		} else {
			await interaction.editReply({
				content: '❌ This feed is already subscribed in this channel.',
			});
		}
	} catch {
		await interaction.editReply({
			content: '❌ Invalid RSS feed URL or the feed is unreachable.',
		});
	}
}
