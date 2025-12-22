import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	MessageFlags,
} from 'discord.js';
import {
	getSubscriptionChannels,
	removeSubscriptionsByIds,
	removePostHistoryBySubscriptionIds,
} from '../database.ts';
import { createLogger } from '../logger.ts';

const logger = createLogger('cleanup');

export const data = new SlashCommandBuilder()
	.setName('cleanup')
	.setDescription('Remove subscriptions for deleted channels')
	.addBooleanOption((option) =>
		option
			.setName('dry_run')
			.setDescription('Preview what would be deleted without actually deleting')
			.setRequired(false),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const dryRun = interaction.options.getBoolean('dry_run') ?? false;

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const guildId = interaction.guildId!;
	const subscriptions = getSubscriptionChannels(guildId);

	if (subscriptions.length === 0) {
		await interaction.editReply({
			content: '📭 No subscriptions found in this server.',
		});
		return;
	}

	// Check which channels still exist
	const orphanedIds: number[] = [];
	const orphanedDetails: string[] = [];

	for (const sub of subscriptions) {
		try {
			await interaction.client.channels.fetch(sub.channel_id);
		} catch {
			// Channel doesn't exist or bot doesn't have access
			orphanedIds.push(sub.id);
			const name = sub.feed_name || sub.feed_url;
			orphanedDetails.push(`• #${sub.id}: ${name}`);
		}
	}

	if (orphanedIds.length === 0) {
		await interaction.editReply({
			content: '✅ All subscriptions are linked to valid channels. Nothing to clean up.',
		});
		return;
	}

	if (dryRun) {
		const preview =
			orphanedDetails.length > 10
				? orphanedDetails.slice(0, 10).join('\n') +
					`\n... and ${orphanedDetails.length - 10} more`
				: orphanedDetails.join('\n');

		await interaction.editReply({
			content: `🔍 **Dry run** - Found ${orphanedIds.length} orphaned subscription(s):\n${preview}\n\nRun \`/cleanup\` without \`dry_run\` to delete them.`,
		});
		return;
	}

	// Actually delete the orphaned subscriptions
	const historyDeleted = removePostHistoryBySubscriptionIds(orphanedIds);
	const subsDeleted = removeSubscriptionsByIds(guildId, orphanedIds);

	logger.info('Cleaned up orphaned subscriptions', {
		guildId,
		subscriptionsDeleted: subsDeleted,
		historyDeleted,
	});

	const details =
		orphanedDetails.length > 10
			? orphanedDetails.slice(0, 10).join('\n') +
				`\n... and ${orphanedDetails.length - 10} more`
			: orphanedDetails.join('\n');

	await interaction.editReply({
		content: `🧹 Cleaned up ${subsDeleted} orphaned subscription(s) and ${historyDeleted} history entries:\n${details}`,
	});
}
