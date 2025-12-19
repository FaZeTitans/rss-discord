import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	MessageFlags,
} from 'discord.js';
import { getSubscriptionById, updateSubscription } from '../database.ts';

export const data = new SlashCommandBuilder()
	.setName('resume')
	.setDescription('Resume a paused RSS subscription')
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

	if (!sub.paused) {
		await interaction.reply({
			content: `▶️ **${sub.feed_name || sub.feed_url}** is not paused.`,
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	updateSubscription(id, { paused: 0 });

	await interaction.reply({
		content: `▶️ Resumed **${sub.feed_name || sub.feed_url}**.`,
	});
}
