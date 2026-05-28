import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Logger, createLogger } from '../src/logger.ts';

describe('Logger', () => {
	let originalConsoleLog: typeof console.log;
	let originalConsoleWarn: typeof console.warn;
	let originalConsoleError: typeof console.error;
	let logs: string[];

	beforeEach(() => {
		logs = [];
		originalConsoleLog = console.log;
		originalConsoleWarn = console.warn;
		originalConsoleError = console.error;

		console.log = (...args: unknown[]) => logs.push(String(args[0]));
		console.warn = (...args: unknown[]) => logs.push(String(args[0]));
		console.error = (...args: unknown[]) => logs.push(String(args[0]));
	});

	it('should create a logger with context', () => {
		const logger = new Logger('test-context');
		logger.info('test message');

		expect(logs.length).toBe(1);
		expect(logs[0]).toContain('[test-context]');
		expect(logs[0]).toContain('test message');
	});

	it('should include log level in output', () => {
		const logger = new Logger('app');
		logger.setLevel('debug');

		logger.debug('debug message');
		logger.info('info message');
		logger.warn('warn message');
		logger.error('error message');

		expect(logs.length).toBe(4);
		expect(logs[0]).toContain('DEBUG');
		expect(logs[1]).toContain('INFO');
		expect(logs[2]).toContain('WARN');
		expect(logs[3]).toContain('ERROR');
	});

	it('should respect log level filtering', () => {
		const logger = new Logger('app');
		logger.setLevel('warn');

		logger.debug('debug');
		logger.info('info');
		logger.warn('warn');
		logger.error('error');

		expect(logs.length).toBe(2);
		expect(logs[0]).toContain('warn');
		expect(logs[1]).toContain('error');
	});

	it('should include context data in output', () => {
		const logger = new Logger('app');
		logger.info('user action', { userId: '123', action: 'login' });

		expect(logs[0]).toContain('userId');
		expect(logs[0]).toContain('123');
		expect(logs[0]).toContain('action');
		expect(logs[0]).toContain('login');
	});

	it('should create child loggers with combined context', () => {
		const parentLogger = new Logger('parent');
		const childLogger = parentLogger.child('child');

		childLogger.info('test');

		expect(logs[0]).toContain('[parent:child]');
	});

	it('should include timestamp in ISO format', () => {
		const logger = new Logger('app');
		logger.info('test');

		// Check for ISO date pattern
		expect(logs[0]).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
	});

	it('should handle error objects correctly', () => {
		const logger = new Logger('app');
		const error = new Error('Test error');

		logger.error('Something went wrong', error);

		expect(logs[0]).toContain('Test error');
	});

	it('createLogger should create a logger with the given context', () => {
		const logger = createLogger('my-module');
		logger.info('hello');

		expect(logs[0]).toContain('[my-module]');
	});

	// Restore console methods
	afterEach(() => {
		console.log = originalConsoleLog;
		console.warn = originalConsoleWarn;
		console.error = originalConsoleError;
	});
});
