import { describe, it, expect } from 'bun:test';

// Mock the subscription type for testing
interface MockSubscription {
	id: number;
	include_keywords: string | null;
	exclude_keywords: string | null;
	use_regex: number;
}

interface MockFeedItem {
	title?: string;
	content?: string;
	contentSnippet?: string;
}

// Extract the filter logic to test it independently
function passesKeywordFilters(sub: MockSubscription, item: MockFeedItem): boolean {
	const text =
		`${item.title || ''} ${item.contentSnippet || item.content || ''}`.toLowerCase();

	const useRegex = sub.use_regex === 1;

	const matchesPattern = (pattern: string, searchText: string): boolean => {
		if (useRegex) {
			try {
				const regex = new RegExp(pattern, 'i');
				return regex.test(searchText);
			} catch {
				return searchText.includes(pattern.toLowerCase());
			}
		}
		return searchText.includes(pattern.toLowerCase());
	};

	if (sub.include_keywords) {
		const patterns = sub.include_keywords.split(',').map((k) => k.trim());
		const hasMatch = patterns.some((pattern) => matchesPattern(pattern, text));
		if (!hasMatch) return false;
	}

	if (sub.exclude_keywords) {
		const patterns = sub.exclude_keywords.split(',').map((k) => k.trim());
		const hasExcluded = patterns.some((pattern) => matchesPattern(pattern, text));
		if (hasExcluded) return false;
	}

	return true;
}

describe('Keyword Filters', () => {
	describe('without regex', () => {
		it('should pass when no filters are set', () => {
			const sub: MockSubscription = {
				id: 1,
				include_keywords: null,
				exclude_keywords: null,
				use_regex: 0,
			};
			const item: MockFeedItem = { title: 'Hello World' };
			expect(passesKeywordFilters(sub, item)).toBe(true);
		});

		it('should match include keywords (case insensitive)', () => {
			const sub: MockSubscription = {
				id: 1,
				include_keywords: 'rust, python',
				exclude_keywords: null,
				use_regex: 0,
			};

			expect(
				passesKeywordFilters(sub, { title: 'Learning Rust programming' }),
			).toBe(true);
			expect(
				passesKeywordFilters(sub, { title: 'PYTHON is awesome' }),
			).toBe(true);
			expect(
				passesKeywordFilters(sub, { title: 'JavaScript tutorial' }),
			).toBe(false);
		});

		it('should exclude matching keywords', () => {
			const sub: MockSubscription = {
				id: 1,
				include_keywords: null,
				exclude_keywords: 'spam, advertisement',
				use_regex: 0,
			};

			expect(passesKeywordFilters(sub, { title: 'Great article' })).toBe(true);
			expect(passesKeywordFilters(sub, { title: 'This is SPAM!' })).toBe(false);
			expect(
				passesKeywordFilters(sub, { title: 'Buy now - advertisement' }),
			).toBe(false);
		});

		it('should combine include and exclude filters', () => {
			const sub: MockSubscription = {
				id: 1,
				include_keywords: 'rust',
				exclude_keywords: 'beginner',
				use_regex: 0,
			};

			expect(
				passesKeywordFilters(sub, { title: 'Advanced Rust techniques' }),
			).toBe(true);
			expect(
				passesKeywordFilters(sub, { title: 'Rust for beginners' }),
			).toBe(false);
			expect(
				passesKeywordFilters(sub, { title: 'Python advanced' }),
			).toBe(false);
		});

		it('should search in both title and content', () => {
			const sub: MockSubscription = {
				id: 1,
				include_keywords: 'secret',
				exclude_keywords: null,
				use_regex: 0,
			};

			expect(
				passesKeywordFilters(sub, {
					title: 'Normal title',
					content: 'The secret is here',
				}),
			).toBe(true);
			expect(
				passesKeywordFilters(sub, {
					title: 'Secret revealed',
					content: 'Nothing special',
				}),
			).toBe(true);
		});
	});

	describe('with regex', () => {
		it('should match regex patterns', () => {
			const sub: MockSubscription = {
				id: 1,
				include_keywords: '\\brust\\b',
				exclude_keywords: null,
				use_regex: 1,
			};

			expect(
				passesKeywordFilters(sub, { title: 'Learning Rust today' }),
			).toBe(true);
			expect(
				passesKeywordFilters(sub, { title: 'Trusted source' }),
			).toBe(false);
		});

		it('should support complex regex patterns', () => {
			const sub: MockSubscription = {
				id: 1,
				include_keywords: 'v\\d+\\.\\d+',
				exclude_keywords: null,
				use_regex: 1,
			};

			expect(
				passesKeywordFilters(sub, { title: 'Release v1.0 is out' }),
			).toBe(true);
			expect(
				passesKeywordFilters(sub, { title: 'Version v12.34 released' }),
			).toBe(true);
			expect(
				passesKeywordFilters(sub, { title: 'New version coming' }),
			).toBe(false);
		});

		it('should exclude with regex', () => {
			const sub: MockSubscription = {
				id: 1,
				include_keywords: null,
				exclude_keywords: '\\[AD\\]|\\[SPONSORED\\]',
				use_regex: 1,
			};

			expect(passesKeywordFilters(sub, { title: 'Great article' })).toBe(true);
			expect(passesKeywordFilters(sub, { title: '[AD] Buy now' })).toBe(false);
			expect(
				passesKeywordFilters(sub, { title: '[SPONSORED] Check this' }),
			).toBe(false);
		});

		it('should fallback to literal match on invalid regex', () => {
			const sub: MockSubscription = {
				id: 1,
				include_keywords: '[invalid',
				exclude_keywords: null,
				use_regex: 1,
			};

			// Should still work with literal match
			expect(
				passesKeywordFilters(sub, { title: 'Contains [invalid text' }),
			).toBe(true);
			expect(passesKeywordFilters(sub, { title: 'Normal text' })).toBe(false);
		});
	});
});
