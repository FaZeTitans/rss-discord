import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	EmbedBuilder,
	ChannelType,
} from 'discord.js';
import { getGuildSettings, upsertGuildSettings } from '../database.ts';

export const data = new SlashCommandBuilder()
	.setName('settings')
	.setDescription('Configure server-wide RSS bot settings')
	.addChannelOption((option) =>
		option
			.setName('alert_channel')
			.setDescription('Channel for feed error alerts')
			.addChannelTypes(ChannelType.GuildText),
	)
	.addIntegerOption((option) =>
		option
			.setName('alert_threshold')
			.setDescription('Number of errors before alerting (default: 3)')
			.setMinValue(1)
			.setMaxValue(10),
	)
	.addStringOption((option) =>
		option
			.setName('default_color')
			.setDescription('Default embed color for new feeds (hex, e.g., #3498db)'),
	)
	.addBooleanOption((option) =>
		option
			.setName('buttons_enabled')
			.setDescription('Show Read/Share buttons under embeds'),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const alertChannel = interaction.options.getChannel('alert_channel');
	const alertThreshold = interaction.options.getInteger('alert_threshold');
	const defaultColor = interaction.options.getString('default_color');
	const buttonsEnabled = interaction.options.getBoolean('buttons_enabled');

	// If no options provided, show current settings
	if (
		alertChannel === null &&
		alertThreshold === null &&
		defaultColor === null &&
		buttonsEnabled === null
	) {
		const settings = getGuildSettings(interaction.guildId!);

		const embed = new EmbedBuilder()
			.setColor(0x3498db)
			.setTitle('⚙️ Server Settings')
			.addFields(
				{
					name: 'Alert Channel',
					value: settings?.alert_channel_id
						? `<#${settings.alert_channel_id}>`
						: 'Not set',
					inline: true,
				},
				{
					name: 'Alert Threshold',
					value: `${settings?.alert_threshold ?? 3} errors`,
					inline: true,
				},
				{
					name: 'Default Color',
					value: settings?.default_color
						? `#${settings.default_color}`
						: 'Auto (by domain)',
					inline: true,
				},
				{
					name: 'Buttons',
					value: settings?.buttons_enabled !== 0 ? 'Enabled' : 'Disabled',
					inline: true,
				},
			);

		await interaction.reply({ embeds: [embed] });
		return;
	}

	// Update settings
	const updates: Record<string, unknown> = {};

	if (alertChannel !== null) {
		updates.alert_channel_id = alertChannel.id;
	}

	if (alertThreshold !== null) {
		updates.alert_threshold = alertThreshold;
	}

	if (defaultColor !== null) {
		if (defaultColor && !/^#?[0-9A-Fa-f]{6}$/.test(defaultColor)) {
			await interaction.reply({
				content: '❌ Invalid color format. Use hex format like `#3498db`.',
				ephemeral: true,
			});
			return;
		}
		updates.default_color = defaultColor ? defaultColor.replace('#', '') : null;
	}

	if (buttonsEnabled !== null) {
		updates.buttons_enabled = buttonsEnabled ? 1 : 0;
	}

	upsertGuildSettings(interaction.guildId!, updates);

	const changes = Object.entries(updates)
		.map(([key, value]) => {
			if (key === 'alert_channel_id') return `• **Alert Channel**: <#${value}>`;
			if (key === 'buttons_enabled')
				return `• **Buttons**: ${value ? 'Enabled' : 'Disabled'}`;
			return `• **${key}**: ${value ?? 'removed'}`;
		})
		.join('\n');

	await interaction.reply({
		content: `✅ Settings updated:\n${changes}`,
	});
}
