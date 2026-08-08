import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Chat Models API - Extended Branch Coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('GET /api/chat/models', () => {
		it('should return empty models when no AI keys configured', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1' }
				},
				platform: {
					env: {
						KV: {
							get: vi.fn().mockResolvedValue(null)
						}
					}
				}
			};

			const { GET } = await import('../../src/routes/api/chat/models/+server');
			const response = await GET(mockEvent as any);
			const data = await response.json();

			expect(data.models).toBeDefined();
			expect(Array.isArray(data.models)).toBe(true);
		});

		it('should prefer gpt-4o when gpt-4o-mini not available', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1' }
				},
				platform: {
					env: {
						KV: {
							get: vi.fn().mockImplementation((key: string) => {
								if (key === 'ai_keys_list') {
									return JSON.stringify(['key-1']);
								}
								if (key === 'ai_key:key-1') {
									return JSON.stringify({
										id: 'key-1',
										provider: 'openai',
										apiKey: 'test-key',
										enabled: true,
										models: ['gpt-4o', 'gpt-3.5-turbo']
									});
								}
								return null;
							})
						}
					}
				},
				fetch: vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							data: [{ id: 'gpt-4o' }, { id: 'gpt-3.5-turbo' }]
						})
				})
			};

			const { GET } = await import('../../src/routes/api/chat/models/+server');
			const response = await GET(mockEvent as any);
			const data = await response.json();

			// Should prefer gpt-4o when gpt-4o-mini is not in the available models
			expect(data.defaultModel).toBe('gpt-4o');
		});

		it('should use gpt-4o-mini as default when available', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1' }
				},
				platform: {
					env: {
						KV: {
							get: vi.fn().mockImplementation((key: string) => {
								if (key === 'ai_keys_list') {
									return JSON.stringify(['key-1']);
								}
								if (key === 'ai_key:key-1') {
									return JSON.stringify({
										id: 'key-1',
										provider: 'openai',
										apiKey: 'test-key',
										enabled: true,
										models: ['gpt-4o-mini', 'gpt-4o']
									});
								}
								return null;
							})
						}
					}
				},
				fetch: vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }]
						})
				})
			};

			const { GET } = await import('../../src/routes/api/chat/models/+server');
			const response = await GET(mockEvent as any);
			const data = await response.json();

			expect(data.defaultModel).toBe('gpt-4o-mini');
		});
	});
});
