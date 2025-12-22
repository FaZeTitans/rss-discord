/**
 * Structured logging utility for the RSS Discord bot
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const LOG_COLORS: Record<LogLevel, string> = {
	debug: '\x1b[90m', // Gray
	info: '\x1b[36m', // Cyan
	warn: '\x1b[33m', // Yellow
	error: '\x1b[31m', // Red
};

const RESET = '\x1b[0m';

interface LogContext {
	[key: string]: unknown;
}

class Logger {
	private level: LogLevel = 'info';
	private context: string;

	constructor(context: string = 'app') {
		this.context = context;
	}

	setLevel(level: LogLevel): void {
		this.level = level;
	}

	private shouldLog(level: LogLevel): boolean {
		return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
	}

	private formatTimestamp(): string {
		return new Date().toISOString();
	}

	private formatMessage(
		level: LogLevel,
		message: string,
		context?: LogContext,
	): string {
		const timestamp = this.formatTimestamp();
		const color = LOG_COLORS[level];
		const levelStr = level.toUpperCase().padEnd(5);

		let output = `${color}[${timestamp}] [${levelStr}] [${this.context}]${RESET} ${message}`;

		if (context && Object.keys(context).length > 0) {
			output += ` ${JSON.stringify(context)}`;
		}

		return output;
	}

	debug(message: string, context?: LogContext): void {
		if (this.shouldLog('debug')) {
			console.log(this.formatMessage('debug', message, context));
		}
	}

	info(message: string, context?: LogContext): void {
		if (this.shouldLog('info')) {
			console.log(this.formatMessage('info', message, context));
		}
	}

	warn(message: string, context?: LogContext): void {
		if (this.shouldLog('warn')) {
			console.warn(this.formatMessage('warn', message, context));
		}
	}

	error(message: string, error?: Error | unknown, context?: LogContext): void {
		if (this.shouldLog('error')) {
			const errorContext: LogContext = { ...context };
			if (error instanceof Error) {
				errorContext.error = error.message;
				errorContext.stack = error.stack;
			} else if (error) {
				errorContext.error = String(error);
			}
			console.error(this.formatMessage('error', message, errorContext));
		}
	}

	child(context: string): Logger {
		const child = new Logger(`${this.context}:${context}`);
		child.setLevel(this.level);
		return child;
	}
}

// Create default logger instance
const defaultLogger = new Logger('rss-bot');

// Export both the class and a default instance
export { Logger, defaultLogger as logger };

// Convenience function to create a logger for a specific module
export function createLogger(context: string): Logger {
	const log = new Logger(context);
	// Inherit level from environment
	const level = (process.env.LOG_LEVEL || 'info') as LogLevel;
	if (LOG_LEVELS[level] !== undefined) {
		log.setLevel(level);
	}
	return log;
}
