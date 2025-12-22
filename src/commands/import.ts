import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	MessageFlags,
} from 'discord.js';
import { importSubscriptions } from '../database.ts';

export const data = new SlashCommandBuilder()
	.setName('import')
	.setDescription('Import subscriptions from JSON')
	.addAttachmentOption((option) =>
		option
			.setName('file')
			.setDescription('JSON file exported from /export')
			.setRequired(true),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const attachment = interaction.options.getAttachment('file', true);

	if (!attachment.name.endsWith('.json')) {
		await interaction.reply({
			content: '❌ Please provide a JSON file.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await interaction.deferReply();

	try {
		const response = await fetch(attachment.url);
		const text = await response.text();
		const data = JSON.parse(text);

		if (!Array.isArray(data)) {
			await interaction.editReply({
				content: '❌ Invalid JSON format. Expected an array of subscriptions.',
			});
			return;
		}

		const result = importSubscriptions(interaction.guildId!, data);

		let content = `📦 Import complete!\n✅ ${result.success} imported\n❌ ${result.failed} failed`;

		// Show first 5 errors if any
		if (result.errors.length > 0) {
			const displayErrors = result.errors.slice(0, 5);
			content += '\n\n**Errors:**\n' + displayErrors.map((e) => `• ${e}`).join('\n');
			if (result.errors.length > 5) {
				content += `\n... and ${result.errors.length - 5} more`;
			}
		}

		await interaction.editReply({ content });
	} catch (error) {
		await interaction.editReply({
			content: `❌ Failed to import: ${error instanceof Error ? error.message : 'Unknown error'}`,
		});
	}
}
