/**
 * Centralized configuration for the RSS Discord bot
 */

function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`❌ ${name} is not set in environment variables`);
		process.exit(1);
	}
	return value;
}

function getOptionalEnv(name: string, defaultValue: string): string {
	return process.env[name] || defaultValue;
}

function getNumericEnv(name: string, defaultValue: number): number {
	const value = process.env[name];
	if (!value) return defaultValue;
	const parsed = parseInt(value, 10);
	return isNaN(parsed) ? defaultValue : parsed;
}

export const config = {
	// Discord credentials
	token: getRequiredEnv('DISCORD_TOKEN'),
	clientId: getRequiredEnv('DISCORD_CLIENT_ID'),
	guildId: process.env.DISCORD_GUILD_ID || null, // Optional: for instant command updates in dev

	// Environment
	isDev: process.env.NODE_ENV !== 'production',
	nodeEnv: getOptionalEnv('NODE_ENV', 'development'),

	// Database
	databasePath: getOptionalEnv('DATABASE_PATH', 'rss-bot.db'),

	// Intervals (in milliseconds)
	checkInterval: process.env.NODE_ENV !== 'production' ? 30 * 1000 : 5 * 60 * 1000,
	cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours

	// Retention
	historyRetentionDays: getNumericEnv('HISTORY_RETENTION_DAYS', 30),

	// Timeouts
	feedTimeout: getNumericEnv('FEED_TIMEOUT', 10000), // 10 seconds
	shutdownTimeout: getNumericEnv('SHUTDOWN_TIMEOUT', 30000), // 30 seconds

	// Retry settings
	maxRetries: getNumericEnv('MAX_RETRIES', 3),
	retryBaseDelay: getNumericEnv('RETRY_BASE_DELAY', 1000),

	// Logging
	logLevel: getOptionalEnv('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
} as const;

export type Config = typeof config;
