import Parser from 'rss-parser';
import type { Subscription } from './database.ts';
import {
	getActiveSubscriptions,
	updateLastItemGuid,
	updateFeedError,
	clearFeedError,
	incrementPostCount,
	isDuplicatePost,
	addPostHistory,
	getColorForDomain,
	getGuildSettings,
} from './database.ts';
import type { Client, TextChannel } from 'discord.js';
import {
	EmbedBuilder,
	WebhookClient,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} from 'discord.js';

const parser = new Parser({
	customFields: {
		item: [
			['media:content', 'mediaContent'],
			['media:thumbnail', 'mediaThumbnail'],
			['media:group', 'mediaGroup'],
			['enclosure', 'enclosure'],
			['content:encoded', 'contentEncoded'],
			['link', 'links', { keepArray: true }],
		],
	},
});

interface LinkElement {
	$?: { rel?: string; href?: string; title?: string };
}

export interface FeedItem {
	title?: string;
	link?: string;
	pubDate?: string;
	content?: string;
	contentSnippet?: string;
	guid?: string;
	author?: string;
	mediaContent?: { $?: { url?: string } } | { $?: { url?: string } }[];
	mediaThumbnail?: { $?: { url?: string } };
	mediaGroup?: { 'media:content'?: { $?: { url?: string } }[] };
	enclosure?: { url?: string; type?: string };
	contentEncoded?: string;
	links?: (string | LinkElement)[];
}

export interface FeedData {
	title?: string;
	description?: string;
	link?: string;
	image?: { url?: string };
	items: FeedItem[];
}

export async function parseFeed(url: string): Promise<FeedData> {
	return await parser.parseURL(url);
}

export async function checkFeeds(client: Client): Promise<void> {
	const subscriptions = getActiveSubscriptions();

	for (const sub of subscriptions) {
		await checkSingleFeed(client, sub, false);
	}
}

export async function checkSingleFeed(
	client: Client,
	sub: Subscription,
	forcePost: boolean,
): Promise<{ posted: boolean; error?: string }> {
	try {
		const feed = await parseFeed(sub.feed_url);
		const latestItem = feed.items[0];

		if (!latestItem) {
			return { posted: false };
		}

		const itemGuid = latestItem.guid || latestItem.link || latestItem.title;

		if (!itemGuid) {
			return { posted: false };
		}

		// Clear any previous errors since we successfully fetched
		clearFeedError(sub.id);

		// Check if there's a new item
		const isNewItem = sub.last_item_guid !== itemGuid;

		if (isNewItem || forcePost) {
			// Only send if we had a previous guid (not first run) or forcing
			if (sub.last_item_guid || forcePost) {
				// Check keyword filters
				if (!passesKeywordFilters(sub, latestItem)) {
					updateLastItemGuid(sub.id, itemGuid);
					return { posted: false };
				}

				// Check for duplicate posts across feeds (by link) - skip if forcing
				if (
					!forcePost &&
					latestItem.link &&
					isDuplicatePost(sub.guild_id, latestItem.link)
				) {
					updateLastItemGuid(sub.id, itemGuid);
					return { posted: false };
				}

				// Check rate limiting
				if (!incrementPostCount(sub.id)) {
					return { posted: false, error: 'Rate limit exceeded' };
				}

				await sendFeedUpdate(
					client,
					sub,
					latestItem,
					feed.title,
					feed.image?.url,
				);

				// Record post in history for stats and duplicate detection
				addPostHistory(
					sub.guild_id,
					sub.id,
					itemGuid,
					latestItem.title || null,
					latestItem.link || null,
				);

				updateLastItemGuid(sub.id, itemGuid);
				return { posted: true };
			}
			updateLastItemGuid(sub.id, itemGuid);
		}

		return { posted: false };
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error';
		updateFeedError(sub.id, errorMessage);
		console.error(`Error checking feed ${sub.feed_url}:`, error);
		return { posted: false, error: errorMessage };
	}
}

function passesKeywordFilters(sub: Subscription, item: FeedItem): boolean {
	const text =
		`${item.title || ''} ${item.contentSnippet || item.content || ''}`.toLowerCase();

	// Check include keywords (at least one must match)
	if (sub.include_keywords) {
		const keywords = sub.include_keywords
			.split(',')
			.map((k) => k.trim().toLowerCase());
		const hasMatch = keywords.some((keyword) => text.includes(keyword));
		if (!hasMatch) return false;
	}

	// Check exclude keywords (none must match)
	if (sub.exclude_keywords) {
		const keywords = sub.exclude_keywords
			.split(',')
			.map((k) => k.trim().toLowerCase());
		const hasExcluded = keywords.some((keyword) => text.includes(keyword));
		if (hasExcluded) return false;
	}

	return true;
}

function extractImage(item: FeedItem): string | null {
	// Try media:content (can be array or object)
	if (item.mediaContent) {
		const media = Array.isArray(item.mediaContent)
			? item.mediaContent[0]
			: item.mediaContent;
		if (media?.$?.url) return media.$.url;
	}

	// Try media:thumbnail
	if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;

	// Try media:group
	if (item.mediaGroup?.['media:content']?.[0]?.$?.url) {
		return item.mediaGroup['media:content'][0].$.url;
	}

	// Try enclosure (for podcasts/media)
	if (item.enclosure?.url) {
		const type = item.enclosure.type || '';
		if (
			type.startsWith('image/') ||
			/\.(jpg|jpeg|png|gif|webp)$/i.test(item.enclosure.url)
		) {
			return item.enclosure.url;
		}
	}

	// Try to extract from HTML content
	const content = item.contentEncoded || item.content || '';

	// Look for img tags
	const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
	if (imgMatch?.[1]) {
		const url = imgMatch[1];
		// Skip tiny tracking pixels and icons
		if (
			!url.includes('pixel') &&
			!url.includes('tracking') &&
			!url.includes('1x1')
		) {
			return url;
		}
	}

	// Look for og:image or twitter:image meta tags
	const ogMatch = content.match(
		/property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
	);
	if (ogMatch?.[1]) return ogMatch[1];

	// Look for direct image URLs in content
	const urlMatch = content.match(
		/https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp)(\?[^\s"'<>]*)?/i,
	);
	if (urlMatch?.[0]) return urlMatch[0];

	// Generate OpenGraph image for GitHub repos
	const githubMatch = content.match(
		/https?:\/\/github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/,
	);
	if (githubMatch?.[1]) {
		return `https://opengraph.githubassets.com/1/${githubMatch[1]}`;
	}

	return null;
}

function extractRelatedLinks(
	item: FeedItem,
): { url: string; title: string; type: string }[] {
	const relatedLinks: { url: string; title: string; type: string }[] = [];

	// Check links array from feed (rel="related")
	if (item.links && Array.isArray(item.links)) {
		for (const link of item.links) {
			if (typeof link === 'object' && link.$?.href) {
				const href = link.$.href;
				const title = link.$.title || '';
				const rel = link.$.rel || '';

				if (rel === 'related' || href.includes('github.com')) {
					const type = getRelatedLinkType(href);
					if (type) {
						relatedLinks.push({ url: href, title: title || type, type });
					}
				}
			}
		}
	}

	// Also search in content for GitHub links
	const content = item.contentEncoded || item.content || '';
	const githubMatches = content.matchAll(
		/https?:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+/g,
	);

	for (const match of githubMatches) {
		const url = match[0];
		// Avoid duplicates
		if (!relatedLinks.some((l) => l.url === url) && url !== item.link) {
			relatedLinks.push({ url, title: 'GitHub', type: 'github' });
		}
	}

	return relatedLinks.slice(0, 3); // Max 3 related links
}

function getRelatedLinkType(url: string): string | null {
	if (url.includes('github.com')) return 'github';
	if (url.includes('gitlab.com')) return 'gitlab';
	if (url.includes('npmjs.com')) return 'npm';
	if (url.includes('pypi.org')) return 'pypi';
	if (url.includes('crates.io')) return 'crates';
	if (url.includes('docs.')) return 'docs';
	return 'link';
}

function getRelatedLinkEmoji(type: string): string {
	const emojis: Record<string, string> = {
		github: '🐙',
		gitlab: '🦊',
		npm: '📦',
		pypi: '🐍',
		crates: '📦',
		docs: '📚',
		link: '🔗',
	};
	return emojis[type] || '🔗';
}

async function sendFeedUpdate(
	client: Client,
	subscription: Subscription,
	item: FeedItem,
	feedTitle?: string,
	feedImage?: string,
): Promise<void> {
	try {
		// Parse color: custom > domain-based > default blue
		let color = 0x3498db;
		if (subscription.color) {
			color = parseInt(subscription.color, 16);
		} else if (subscription.feed_url) {
			const domainColor = getColorForDomain(subscription.feed_url);
			if (domainColor) {
				color = parseInt(domainColor, 16);
			}
		}

		const embed = new EmbedBuilder()
			.setColor(color)
			.setTitle(truncate(item.title || 'New Post', 256))
			.setURL(item.link || null)
			.setDescription(truncate(item.contentSnippet || item.content || '', 300))
			.setTimestamp(item.pubDate ? new Date(item.pubDate) : new Date())
			.setFooter({
				text: subscription.feed_name || feedTitle || 'RSS Feed',
				iconURL: feedImage,
			});

		if (item.author) {
			embed.setAuthor({ name: item.author });
		}

		// Try to add image
		const image = extractImage(item);
		if (image) {
			embed.setImage(image);
		}

		// Build message content with optional role mention
		const content = subscription.role_id
			? `<@&${subscription.role_id}>`
			: undefined;

		// Build buttons if enabled (default to true if null)
		const components: ActionRowBuilder<ButtonBuilder>[] = [];
		const guildSettings = getGuildSettings(subscription.guild_id);
		const buttonsEnabled =
			(subscription.show_buttons ?? 1) === 1 &&
			(guildSettings?.buttons_enabled ?? 1) === 1;

		if (buttonsEnabled && item.link) {
			const buttons: ButtonBuilder[] = [
				new ButtonBuilder()
					.setLabel('Read')
					.setStyle(ButtonStyle.Link)
					.setURL(item.link),
			];

			// Add related links (GitHub, etc.) - max 3 to stay under 5 button limit
			const relatedLinks = extractRelatedLinks(item);
			for (const related of relatedLinks) {
				buttons.push(
					new ButtonBuilder()
						.setLabel(related.title)
						.setStyle(ButtonStyle.Link)
						.setURL(related.url)
						.setEmoji(getRelatedLinkEmoji(related.type)),
				);
			}

			// Add Share button at the end
			buttons.push(
				new ButtonBuilder()
					.setLabel('Share')
					.setStyle(ButtonStyle.Link)
					.setURL(
						`https://twitter.com/intent/tweet?url=${encodeURIComponent(item.link)}&text=${encodeURIComponent(item.title || '')}`,
					),
			);

			// Discord allows max 5 buttons per row
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				buttons.slice(0, 5),
			);
			components.push(row);
		}

		// Send via webhook or regular channel
		if (subscription.webhook_url) {
			const webhook = new WebhookClient({ url: subscription.webhook_url });
			await webhook.send({
				content,
				embeds: [embed],
				components,
				username: subscription.webhook_name || undefined,
				avatarURL: subscription.webhook_avatar || undefined,
			});
			webhook.destroy();
		} else {
			const channel = await client.channels.fetch(subscription.channel_id);
			if (!channel || !channel.isTextBased()) return;
			await (channel as TextChannel).send({
				content,
				embeds: [embed],
				components,
			});
		}
	} catch (error) {
		console.error(
			`Error sending update to channel ${subscription.channel_id}:`,
			error,
		);
	}
}

function truncate(text: string, maxLength: number): string {
	// Remove HTML tags
	const clean = text.replace(/<[^>]*>/g, '');
	if (clean.length <= maxLength) return clean;
	return clean.slice(0, maxLength - 3) + '...';
}
