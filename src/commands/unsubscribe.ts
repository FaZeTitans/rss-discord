import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	MessageFlags,
} from 'discord.js';
import { removeSubscription, getSubscriptionById } from '../database.ts';

export const data = new SlashCommandBuilder()
	.setName('unsubscribe')
	.setDescription('Unsubscribe from an RSS feed')
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

	const subscription = getSubscriptionById(id);

	if (!subscription || subscription.guild_id !== interaction.guildId) {
		await interaction.reply({
			content: '❌ Subscription not found.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const success = removeSubscription(interaction.guildId!, id);

	if (success) {
		await interaction.reply({
			content: `✅ Unsubscribed from **${subscription.feed_name || subscription.feed_url}**.`,
		});
	} else {
		await interaction.reply({
			content: '❌ Failed to remove subscription.',
			flags: MessageFlags.Ephemeral,
		});
	}
}
