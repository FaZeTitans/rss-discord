import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	MessageFlags,
} from 'discord.js';
import { getSubscriptionById } from '../database.ts';
import { checkSingleFeed } from '../rss.ts';

export const data = new SlashCommandBuilder()
	.setName('test')
	.setDescription('Force an immediate check of a feed')
	.addIntegerOption((option) =>
		option
			.setName('id')
			.setDescription('The subscription ID (use /list to see IDs)')
			.setRequired(true),
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

	await interaction.deferReply();

	try {
		const result = await checkSingleFeed(interaction.client, sub, true);

		if (result.error) {
			await interaction.editReply({
				content: `❌ Error checking feed: ${result.error}`,
			});
		} else if (result.posted) {
			await interaction.editReply({
				content: `✅ Posted latest item from **${sub.feed_name || sub.feed_url}**`,
			});
		} else {
			await interaction.editReply({
				content: `ℹ️ No new items in **${sub.feed_name || sub.feed_url}**`,
			});
		}
	} catch (error) {
		await interaction.editReply({
			content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
		});
	}
}
