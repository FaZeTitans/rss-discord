import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
	.setName('youtube')
	.setDescription('Get RSS feed URL for a YouTube channel')
	.addStringOption((option) =>
		option
			.setName('url')
			.setDescription('YouTube channel URL or @handle')
			.setRequired(true),
	);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const input = interaction.options.getString('url', true);

	await interaction.deferReply();

	try {
		let channelId: string | null = null;

		// Direct channel ID
		if (/^UC[\w-]{22}$/.test(input)) {
			channelId = input;
		}
		// Full URL with channel ID
		else if (input.includes('/channel/')) {
			const match = input.match(/\/channel\/(UC[\w-]{22})/);
			channelId = match?.[1] || null;
		}
		// @handle or /c/ or /user/ - need to fetch the page
		else {
			let url = input;
			if (input.startsWith('@')) {
				url = `https://www.youtube.com/${input}`;
			} else if (!input.startsWith('http')) {
				url = `https://www.youtube.com/@${input}`;
			}

			const response = await fetch(url);
			const html = await response.text();

			// Extract channel ID from page
			const match = html.match(/channel_id=([^"&]+)/);
			channelId = match?.[1] || null;

			if (!channelId) {
				// Try alternative pattern
				const altMatch = html.match(/"channelId":"(UC[\w-]+)"/);
				channelId = altMatch?.[1] || null;
			}
		}

		if (!channelId) {
			await interaction.editReply({
				content: '❌ Could not find channel ID. Make sure the URL is correct.',
			});
			return;
		}

		const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

		const embed = new EmbedBuilder()
			.setColor(0xff0000)
			.setTitle('📺 YouTube RSS Feed')
			.setDescription(
				'Use this URL with `/subscribe` to get notifications for new videos.',
			)
			.addFields(
				{ name: 'Channel ID', value: `\`${channelId}\`` },
				{ name: 'RSS URL', value: `\`\`\`\n${rssUrl}\n\`\`\`` },
			)
			.setFooter({ text: 'Tip: YouTube RSS feeds include the last 15 videos' });

		await interaction.editReply({ embeds: [embed] });
	} catch (error) {
		await interaction.editReply({
			content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
		});
	}
}
