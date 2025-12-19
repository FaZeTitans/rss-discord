import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	MessageFlags,
	ChannelType,
} from 'discord.js';
import type { TextChannel } from 'discord.js';
import { getSubscriptionById, updateSubscription } from '../database.ts';

export const data = new SlashCommandBuilder()
	.setName('webhook')
	.setDescription('Configure webhook for a subscription (custom name/avatar)')
	.addIntegerOption((option) =>
		option
			.setName('id')
			.setDescription('The subscription ID (use /list to see IDs)')
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName('name')
			.setDescription(
				'Custom name for the webhook (leave empty to remove webhook)',
			)
			.setRequired(false),
	)
	.addStringOption((option) =>
		option
			.setName('avatar')
			.setDescription('Avatar URL for the webhook')
			.setRequired(false),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const id = interaction.options.getInteger('id', true);
	const name = interaction.options.getString('name');
	const avatar = interaction.options.getString('avatar');

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
		const channel = await interaction.client.channels.fetch(sub.channel_id);

		if (!channel || channel.type !== ChannelType.GuildText) {
			await interaction.editReply({
				content: '❌ Could not find the subscription channel.',
			});
			return;
		}

		const textChannel = channel as TextChannel;

		// If no name provided, show current status or explain how to use
		if (!name) {
			if (sub.webhook_url) {
				// Delete existing webhook
				try {
					const webhooks = await textChannel.fetchWebhooks();
					const existingWebhook = webhooks.find(
						(w) => w.url === sub.webhook_url,
					);
					if (existingWebhook) {
						await existingWebhook.delete('Webhook removed by RSS bot');
					}
				} catch {
					// Webhook might already be deleted
				}

				updateSubscription(id, {
					webhook_url: null,
					webhook_name: null,
					webhook_avatar: null,
				});

				await interaction.editReply({
					content: `✅ Webhook removed for subscription #${id}. Posts will now be sent as regular bot messages.`,
				});
			} else {
				await interaction.editReply({
					content: `ℹ️ Subscription #${id} has no webhook configured.\n\nTo create one, use:\n\`/webhook id:${id} name:MyCustomName\`\n\nOptionally add an avatar:\n\`/webhook id:${id} name:MyCustomName avatar:https://example.com/image.png\``,
				});
			}
			return;
		}

		// Create or update webhook
		let webhookUrl = sub.webhook_url;

		// Check if we need to create a new webhook
		if (!webhookUrl) {
			const webhook = await textChannel.createWebhook({
				name: name,
				avatar: avatar || undefined,
				reason: `RSS feed webhook for: ${sub.feed_name || sub.feed_url}`,
			});
			webhookUrl = webhook.url;
		} else {
			// Update existing webhook
			try {
				const webhooks = await textChannel.fetchWebhooks();
				const existingWebhook = webhooks.find((w) => w.url === sub.webhook_url);
				if (existingWebhook) {
					await existingWebhook.edit({
						name: name,
						avatar: avatar || undefined,
					});
				} else {
					// Webhook was deleted, create a new one
					const webhook = await textChannel.createWebhook({
						name: name,
						avatar: avatar || undefined,
						reason: `RSS feed webhook for: ${sub.feed_name || sub.feed_url}`,
					});
					webhookUrl = webhook.url;
				}
			} catch {
				// Create a new webhook if update fails
				const webhook = await textChannel.createWebhook({
					name: name,
					avatar: avatar || undefined,
					reason: `RSS feed webhook for: ${sub.feed_name || sub.feed_url}`,
				});
				webhookUrl = webhook.url;
			}
		}

		updateSubscription(id, {
			webhook_url: webhookUrl,
			webhook_name: name,
			webhook_avatar: avatar || null,
		});

		await interaction.editReply({
			content: `✅ Webhook configured for subscription #${id}:\n• **Name**: ${name}\n• **Avatar**: ${avatar || 'Default'}`,
		});
	} catch (error) {
		console.error('Error configuring webhook:', error);
		await interaction.editReply({
			content: `❌ Error: ${error instanceof Error ? error.message : 'Could not create webhook. Make sure the bot has Manage Webhooks permission.'}`,
		});
	}
}
