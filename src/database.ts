import { Database } from 'bun:sqlite';

const dbPath = process.env.DATABASE_PATH || 'rss-bot.db';
const db = new Database(dbPath);

// Initialize database schema
db.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        feed_url TEXT NOT NULL,
        feed_name TEXT,
        last_item_guid TEXT,
        color TEXT,
        role_id TEXT,
        paused INTEGER DEFAULT 0,
        include_keywords TEXT,
        exclude_keywords TEXT,
        max_posts_per_hour INTEGER,
        posts_this_hour INTEGER DEFAULT 0,
        hour_started_at TEXT,
        webhook_url TEXT,
        webhook_name TEXT,
        webhook_avatar TEXT,
        last_check_at TEXT,
        error_count INTEGER DEFAULT 0,
        last_error TEXT,
        category TEXT,
        template TEXT,
        show_buttons INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, channel_id, feed_url)
    )
`);

// Guild settings table
db.run(`
    CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        alert_channel_id TEXT,
        alert_threshold INTEGER DEFAULT 3,
        default_color TEXT,
        buttons_enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Post history for stats and duplicate detection
db.run(`
    CREATE TABLE IF NOT EXISTS post_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        subscription_id INTEGER NOT NULL,
        item_guid TEXT NOT NULL,
        item_title TEXT,
        item_link TEXT,
        posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, item_link)
    )
`);

// Create indexes for faster lookups
db.run(
	`CREATE INDEX IF NOT EXISTS idx_post_history_guild ON post_history(guild_id)`,
);
db.run(
	`CREATE INDEX IF NOT EXISTS idx_post_history_link ON post_history(item_link)`,
);
db.run(
	`CREATE INDEX IF NOT EXISTS idx_subscriptions_guild ON subscriptions(guild_id)`,
);
db.run(
	`CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(paused)`,
);

// Migrations for existing databases
const columns = db
	.query<{ name: string }, []>('PRAGMA table_info(subscriptions)')
	.all();
const columnNames = columns.map((c) => c.name);

const migrations: Record<string, string> = {
	color: 'ALTER TABLE subscriptions ADD COLUMN color TEXT',
	role_id: 'ALTER TABLE subscriptions ADD COLUMN role_id TEXT',
	paused: 'ALTER TABLE subscriptions ADD COLUMN paused INTEGER DEFAULT 0',
	include_keywords:
		'ALTER TABLE subscriptions ADD COLUMN include_keywords TEXT',
	exclude_keywords:
		'ALTER TABLE subscriptions ADD COLUMN exclude_keywords TEXT',
	max_posts_per_hour:
		'ALTER TABLE subscriptions ADD COLUMN max_posts_per_hour INTEGER',
	posts_this_hour:
		'ALTER TABLE subscriptions ADD COLUMN posts_this_hour INTEGER DEFAULT 0',
	hour_started_at: 'ALTER TABLE subscriptions ADD COLUMN hour_started_at TEXT',
	webhook_url: 'ALTER TABLE subscriptions ADD COLUMN webhook_url TEXT',
	webhook_name: 'ALTER TABLE subscriptions ADD COLUMN webhook_name TEXT',
	webhook_avatar: 'ALTER TABLE subscriptions ADD COLUMN webhook_avatar TEXT',
	last_check_at: 'ALTER TABLE subscriptions ADD COLUMN last_check_at TEXT',
	error_count:
		'ALTER TABLE subscriptions ADD COLUMN error_count INTEGER DEFAULT 0',
	last_error: 'ALTER TABLE subscriptions ADD COLUMN last_error TEXT',
	category: 'ALTER TABLE subscriptions ADD COLUMN category TEXT',
	template: 'ALTER TABLE subscriptions ADD COLUMN template TEXT',
	show_buttons:
		'ALTER TABLE subscriptions ADD COLUMN show_buttons INTEGER DEFAULT 1',
};

for (const [column, sql] of Object.entries(migrations)) {
	if (!columnNames.includes(column)) {
		db.run(sql);
	}
}

export interface Subscription {
	id: number;
	guild_id: string;
	channel_id: string;
	feed_url: string;
	feed_name: string | null;
	last_item_guid: string | null;
	color: string | null;
	role_id: string | null;
	paused: number;
	include_keywords: string | null;
	exclude_keywords: string | null;
	max_posts_per_hour: number | null;
	posts_this_hour: number;
	hour_started_at: string | null;
	webhook_url: string | null;
	webhook_name: string | null;
	webhook_avatar: string | null;
	last_check_at: string | null;
	error_count: number;
	last_error: string | null;
	category: string | null;
	template: string | null;
	show_buttons: number;
	created_at: string;
}

export interface GuildSettings {
	guild_id: string;
	alert_channel_id: string | null;
	alert_threshold: number;
	default_color: string | null;
	buttons_enabled: number;
	created_at: string;
}

export interface PostHistory {
	id: number;
	guild_id: string;
	subscription_id: number;
	item_guid: string;
	item_title: string | null;
	item_link: string | null;
	posted_at: string;
}

// Subscription functions
export function addSubscription(
	guildId: string,
	channelId: string,
	feedUrl: string,
	feedName: string | null,
	color: string | null = null,
	roleId: string | null = null,
	category: string | null = null,
): boolean {
	try {
		db.run(
			`INSERT INTO subscriptions (guild_id, channel_id, feed_url, feed_name, color, role_id, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[guildId, channelId, feedUrl, feedName, color, roleId, category],
		);
		return true;
	} catch {
		return false;
	}
}

export function updateSubscription(
	id: number,
	updates: Partial<Omit<Subscription, 'id' | 'guild_id' | 'created_at'>>,
): boolean {
	const fields = Object.keys(updates);
	if (fields.length === 0) return false;

	const setClause = fields.map((f) => `${f} = ?`).join(', ');
	const values = Object.values(updates);

	const result = db.run(`UPDATE subscriptions SET ${setClause} WHERE id = ?`, [
		...values,
		id,
	]);
	return result.changes > 0;
}

export function removeSubscription(
	guildId: string,
	subscriptionId: number,
): boolean {
	const result = db.run(
		'DELETE FROM subscriptions WHERE id = ? AND guild_id = ?',
		[subscriptionId, guildId],
	);
	return result.changes > 0;
}

export function getSubscriptions(guildId: string): Subscription[] {
	return db
		.query<
			Subscription,
			[string]
		>('SELECT * FROM subscriptions WHERE guild_id = ? ORDER BY created_at DESC')
		.all(guildId);
}

export function getSubscriptionsByCategory(
	guildId: string,
	category: string,
): Subscription[] {
	return db
		.query<
			Subscription,
			[string, string]
		>('SELECT * FROM subscriptions WHERE guild_id = ? AND category = ? ORDER BY created_at DESC')
		.all(guildId, category);
}

export function getCategories(guildId: string): string[] {
	const results = db
		.query<
			{ category: string },
			[string]
		>('SELECT DISTINCT category FROM subscriptions WHERE guild_id = ? AND category IS NOT NULL')
		.all(guildId);
	return results.map((r) => r.category);
}

export function getAllSubscriptions(): Subscription[] {
	return db.query<Subscription, []>('SELECT * FROM subscriptions').all();
}

export function getActiveSubscriptions(): Subscription[] {
	return db
		.query<Subscription, []>('SELECT * FROM subscriptions WHERE paused = 0')
		.all();
}

export function getSubscriptionsWithErrors(threshold: number): Subscription[] {
	return db
		.query<
			Subscription,
			[number]
		>('SELECT * FROM subscriptions WHERE error_count >= ? AND paused = 0')
		.all(threshold);
}

export function updateLastItemGuid(subscriptionId: number, guid: string): void {
	db.run(
		"UPDATE subscriptions SET last_item_guid = ?, last_check_at = datetime('now') WHERE id = ?",
		[guid, subscriptionId],
	);
}

export function updateFeedError(subscriptionId: number, error: string): void {
	db.run(
		"UPDATE subscriptions SET error_count = error_count + 1, last_error = ?, last_check_at = datetime('now') WHERE id = ?",
		[error, subscriptionId],
	);
}

export function clearFeedError(subscriptionId: number): void {
	db.run(
		'UPDATE subscriptions SET error_count = 0, last_error = NULL WHERE id = ?',
		[subscriptionId],
	);
}

export function incrementPostCount(subscriptionId: number): boolean {
	const sub = getSubscriptionById(subscriptionId);
	if (!sub || !sub.max_posts_per_hour) return true;

	const now = new Date();
	const hourStart = sub.hour_started_at ? new Date(sub.hour_started_at) : null;

	if (!hourStart || now.getTime() - hourStart.getTime() > 3600000) {
		db.run(
			"UPDATE subscriptions SET posts_this_hour = 1, hour_started_at = datetime('now') WHERE id = ?",
			[subscriptionId],
		);
		return true;
	}

	if (sub.posts_this_hour >= sub.max_posts_per_hour) {
		return false;
	}

	db.run(
		'UPDATE subscriptions SET posts_this_hour = posts_this_hour + 1 WHERE id = ?',
		[subscriptionId],
	);
	return true;
}

export function getSubscriptionById(id: number): Subscription | null {
	return db
		.query<Subscription, [number]>('SELECT * FROM subscriptions WHERE id = ?')
		.get(id);
}

export function exportSubscriptions(guildId: string): string {
	const subs = getSubscriptions(guildId);
	return JSON.stringify(subs, null, 2);
}

export function importSubscriptions(
	guildId: string,
	data: Partial<Subscription>[],
): { success: number; failed: number; errors: string[] } {
	let success = 0;
	let failed = 0;
	const errors: string[] = [];

	for (let i = 0; i < data.length; i++) {
		const sub = data[i];

		// Validate required fields
		if (!sub.channel_id || typeof sub.channel_id !== 'string') {
			errors.push(`Entry ${i + 1}: missing or invalid channel_id`);
			failed++;
			continue;
		}
		if (!sub.feed_url || typeof sub.feed_url !== 'string') {
			errors.push(`Entry ${i + 1}: missing or invalid feed_url`);
			failed++;
			continue;
		}

		// Validate URL format
		try {
			new URL(sub.feed_url);
		} catch {
			errors.push(`Entry ${i + 1}: invalid feed_url format`);
			failed++;
			continue;
		}

		// Validate optional color format if provided
		if (sub.color && !/^#?[0-9A-Fa-f]{6}$/.test(sub.color)) {
			errors.push(`Entry ${i + 1}: invalid color format (expected hex)`);
			failed++;
			continue;
		}

		try {
			const added = addSubscription(
				guildId,
				sub.channel_id,
				sub.feed_url,
				sub.feed_name || null,
				sub.color || null,
				sub.role_id || null,
				sub.category || null,
			);
			if (added) {
				success++;
			} else {
				errors.push(`Entry ${i + 1}: duplicate subscription`);
				failed++;
			}
		} catch (error) {
			errors.push(
				`Entry ${i + 1}: ${error instanceof Error ? error.message : 'unknown error'}`,
			);
			failed++;
		}
	}

	return { success, failed, errors };
}

// Guild settings functions
export function getGuildSettings(guildId: string): GuildSettings | null {
	return db
		.query<
			GuildSettings,
			[string]
		>('SELECT * FROM guild_settings WHERE guild_id = ?')
		.get(guildId);
}

export function upsertGuildSettings(
	guildId: string,
	updates: Partial<Omit<GuildSettings, 'guild_id' | 'created_at'>>,
): void {
	const existing = getGuildSettings(guildId);

	if (existing) {
		const fields = Object.keys(updates);
		if (fields.length === 0) return;
		const setClause = fields.map((f) => `${f} = ?`).join(', ');
		const values = Object.values(updates);
		db.run(`UPDATE guild_settings SET ${setClause} WHERE guild_id = ?`, [
			...values,
			guildId,
		]);
	} else {
		db.run(
			`INSERT INTO guild_settings (guild_id, alert_channel_id, alert_threshold, default_color, buttons_enabled)
       VALUES (?, ?, ?, ?, ?)`,
			[
				guildId,
				updates.alert_channel_id || null,
				updates.alert_threshold ?? 3,
				updates.default_color || null,
				updates.buttons_enabled ?? 1,
			],
		);
	}
}

// Post history functions
export function addPostHistory(
	guildId: string,
	subscriptionId: number,
	itemGuid: string,
	itemTitle: string | null,
	itemLink: string | null,
): boolean {
	try {
		db.run(
			`INSERT INTO post_history (guild_id, subscription_id, item_guid, item_title, item_link)
       VALUES (?, ?, ?, ?, ?)`,
			[guildId, subscriptionId, itemGuid, itemTitle, itemLink],
		);
		return true;
	} catch {
		return false; // Duplicate
	}
}

export function isDuplicatePost(guildId: string, itemLink: string): boolean {
	const result = db
		.query<
			{ count: number },
			[string, string]
		>('SELECT COUNT(*) as count FROM post_history WHERE guild_id = ? AND item_link = ?')
		.get(guildId, itemLink);
	return (result?.count ?? 0) > 0;
}

export function getPostStats(
	guildId: string,
	days: number = 7,
): {
	total: number;
	bySubscription: { id: number; name: string; count: number }[];
	byDay: { date: string; count: number }[];
} {
	const total =
		db
			.query<{ count: number }, [string, number]>(
				`SELECT COUNT(*) as count FROM post_history
       WHERE guild_id = ? AND posted_at >= datetime('now', '-' || ? || ' days')`,
			)
			.get(guildId, days)?.count ?? 0;

	const bySubscription = db
		.query<{ id: number; name: string; count: number }, [string, number]>(
			`SELECT s.id, COALESCE(s.feed_name, s.feed_url) as name, COUNT(p.id) as count
       FROM subscriptions s
       LEFT JOIN post_history p ON s.id = p.subscription_id
         AND p.posted_at >= datetime('now', '-' || ? || ' days')
       WHERE s.guild_id = ?
       GROUP BY s.id
       ORDER BY count DESC`,
		)
		.all(days, guildId);

	const byDay = db
		.query<{ date: string; count: number }, [string, number]>(
			`SELECT date(posted_at) as date, COUNT(*) as count
       FROM post_history
       WHERE guild_id = ? AND posted_at >= datetime('now', '-' || ? || ' days')
       GROUP BY date(posted_at)
       ORDER BY date DESC`,
		)
		.all(guildId, days);

	return { total, bySubscription, byDay };
}

export function cleanOldHistory(days: number = 30): number {
	const result = db.run(
		`DELETE FROM post_history WHERE posted_at < datetime('now', '-' || ? || ' days')`,
		[days],
	);
	return result.changes;
}

// Domain color helper
const domainColors: Record<string, string> = {
	'github.com': '238636',
	'twitter.com': '1DA1F2',
	'x.com': '000000',
	'reddit.com': 'FF4500',
	'youtube.com': 'FF0000',
	'medium.com': '000000',
	'dev.to': '0A0A0A',
	'hackernews.com': 'FF6600',
	'news.ycombinator.com': 'FF6600',
	'stackoverflow.com': 'F48024',
	'linkedin.com': '0A66C2',
	'facebook.com': '1877F2',
	'instagram.com': 'E4405F',
	'twitch.tv': '9146FF',
	'discord.com': '5865F2',
};

export function getColorForDomain(url: string): string | null {
	try {
		const hostname = new URL(url).hostname.replace('www.', '');
		return domainColors[hostname] || null;
	} catch {
		return null;
	}
}
