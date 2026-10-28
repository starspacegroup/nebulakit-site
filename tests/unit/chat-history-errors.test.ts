/**
 * Chat History Error Path Tests
 *
 * Tests for localStorage error handling in chatHistory store
 * to cover lines 73, 78-79, 92-93.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Chat History Store - Error Paths', () => {
	let chatHistoryStore: any;

	beforeEach(async () => {
		vi.resetModules();

		// Ensure localStorage is available
		if (typeof globalThis.localStorage === 'undefined') {
			Object.defineProperty(globalThis, 'localStorage', {
				value: {
					_store: {} as Record<string, string>,
					getItem(key: string) {
						return this._store[key] ?? null;
					},
					setItem(key: string, value: string) {
						this._store[key] = value;
					},
					removeItem(key: string) {
						delete this._store[key];
					},
					clear() {
						this._store = {};
					}
				},
				writable: true,
				configurable: true
			});
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should handle localStorage.getItem returning invalid JSON', async () => {
		// happy-dom's Storage is a Proxy, so replace the global rather than spy on the prototype.
		vi.stubGlobal('localStorage', {
			getItem: () => 'not valid json {{{',
			setItem: () => {},
			removeItem: () => {}
		});
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const module = await import('../../src/lib/stores/chatHistory.js');
		chatHistoryStore = module.chatHistoryStore;

		// Initialize should gracefully handle JSON parse error
		chatHistoryStore.initializeForUser('user-with-bad-data');

		const { get } = await import('svelte/store');
		const state = get(chatHistoryStore) as any;
		// Should fall back to initial state
		expect(state.conversations).toEqual([]);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('Failed to load chat history'),
			expect.anything()
		);

		consoleSpy.mockRestore();
	});

	it('should handle localStorage.getItem throwing an error', async () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('Storage access denied');
			},
			setItem: () => {},
			removeItem: () => {}
		});
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const module = await import('../../src/lib/stores/chatHistory.js');
		chatHistoryStore = module.chatHistoryStore;

		chatHistoryStore.initializeForUser('user-error');

		const { get } = await import('svelte/store');
		const state = get(chatHistoryStore) as any;
		expect(state.conversations).toEqual([]);

		consoleSpy.mockRestore();
	});

	it('should handle localStorage.setItem throwing (quota exceeded)', async () => {
		// happy-dom's Storage is a Proxy whose methods are not read from
		// Storage.prototype, so spying on the prototype never intercepts a call.
		// Replace the global with a store that fails the way a full quota does.
		vi.stubGlobal('localStorage', {
			getItem: () => null,
			setItem: () => {
				throw new DOMException('Quota exceeded', 'QuotaExceededError');
			},
			removeItem: () => {}
		});
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const module = await import('../../src/lib/stores/chatHistory.js');
		chatHistoryStore = module.chatHistoryStore;

		// Initialize with a user (triggers save)
		chatHistoryStore.initializeForUser('user-quota');
		// Create conversation (triggers save)
		chatHistoryStore.createConversation();

		// saveToStorage should catch the error and log it
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('Failed to save chat history'),
			expect.anything()
		);

		consoleSpy.mockRestore();
	});
});
