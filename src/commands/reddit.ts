import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
	.setName('reddit')
	.setDescription('Get RSS feed URL for a subreddit')
	.addStringOption((option) =>
		option
			.setName('subreddit')
			.setDescription('Subreddit name (e.g., programming)')
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName('sort')
			.setDescription('Sort method')
			.addChoices(
				{ name: 'Hot', value: 'hot' },
				{ name: 'New', value: 'new' },
				{ name: 'Top', value: 'top' },
				{ name: 'Rising', value: 'rising' },
			),
	)
	.addStringOption((option) =>
		option
			.setName('time')
			.setDescription('Time period (for Top sort)')
			.addChoices(
				{ name: 'Hour', value: 'hour' },
				{ name: 'Day', value: 'day' },
				{ name: 'Week', value: 'week' },
				{ name: 'Month', value: 'month' },
				{ name: 'Year', value: 'year' },
				{ name: 'All Time', value: 'all' },
			),
	);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	let subreddit = interaction.options.getString('subreddit', true);
	const sort = interaction.options.getString('sort') || 'hot';
	const time = interaction.options.getString('time');

	// Clean up subreddit name
	subreddit = subreddit.replace(/^r\//, '').replace(/\/$/, '').trim();

	// Build RSS URL
	let rssUrl = `https://www.reddit.com/r/${subreddit}/${sort}.rss`;
	if (sort === 'top' && time) {
		rssUrl += `?t=${time}`;
	}

	const embed = new EmbedBuilder()
		.setColor(0xff4500)
		.setTitle('🔗 Reddit RSS Feed')
		.setDescription(
			'Use this URL with `/subscribe` to get notifications for new posts.',
		)
		.addFields(
			{ name: 'Subreddit', value: `r/${subreddit}`, inline: true },
			{ name: 'Sort', value: sort, inline: true },
			{ name: 'RSS URL', value: `\`\`\`\n${rssUrl}\n\`\`\`` },
		)
		.setFooter({
			text: "Tip: Use 'new' sort for real-time posts, 'hot' for popular content",
		});

	if (sort === 'top' && time) {
		embed.addFields({ name: 'Time Period', value: time, inline: true });
	}

	await interaction.reply({ embeds: [embed] });
}
