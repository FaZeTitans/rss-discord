import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	AttachmentBuilder,
} from 'discord.js';
import { exportSubscriptions } from '../database.ts';

export const data = new SlashCommandBuilder()
	.setName('export')
	.setDescription('Export all subscriptions as JSON')
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const json = exportSubscriptions(interaction.guildId!);

	const buffer = Buffer.from(json, 'utf-8');
	const attachment = new AttachmentBuilder(buffer, {
		name: `rss-subscriptions-${interaction.guildId}.json`,
	});

	await interaction.reply({
		content: '📦 Here are your RSS subscriptions:',
		files: [attachment],
	});
}
