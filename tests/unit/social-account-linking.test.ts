import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Social Account Linking
 * TDD: Testing the account linking flow and connected accounts API
 */

// Mock SvelteKit modules
const mockRedirect = vi.fn((status: number, location: string) => {
	const err = new Error('Redirect') as Error & { status: number; location: string };
	err.status = status;
	err.location = location;
	throw err;
});

const mockError = vi.fn((status: number, message: string) => {
	const err = new Error(message) as Error & { status: number };
	err.status = status;
	throw err;
});

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => mockRedirect(status, location),
	error: (status: number, message: string) => mockError(status, message),
	json: (data: unknown, init?: ResponseInit) =>
		new Response(JSON.stringify(data), {
			...init,
			headers: { 'Content-Type': 'application/json', ...init?.headers }
		})
}));

describe('Connected Accounts API - GET', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	it('should return 401 if user is not logged in', async () => {
		const { GET } = await import('../../src/routes/api/auth/connections/+server');

		await expect(
			GET({
				locals: {},
				platform: {}
			} as any)
		).rejects.toMatchObject({ status: 401 });
	});

	it('should return list of connected accounts for logged in user', async () => {
		const { GET } = await import('../../src/routes/api/auth/connections/+server');

		const mockConnections = [
			{ provider: 'github', provider_account_id: '12345', created_at: '2024-01-01' },
			{ provider: 'discord', provider_account_id: '67890', created_at: '2024-01-02' }
		];

		const mockPlatform = {
			env: {
				DB: {
					prepare: vi.fn().mockReturnValue({
						bind: vi.fn().mockReturnValue({
							all: vi.fn().mockResolvedValue({ results: mockConnections })
						})
					})
				}
			}
		};

		const response = await GET({
			locals: { user: { id: 'user-123' } },
			platform: mockPlatform
		} as any);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.connections).toHaveLength(2);
		expect(data.connections[0].provider).toBe('github');
		expect(data.connections[1].provider).toBe('discord');
	});

	it('should return empty array if no connections exist', async () => {
		const { GET } = await import('../../src/routes/api/auth/connections/+server');

		const mockPlatform = {
			env: {
				DB: {
					prepare: vi.fn().mockReturnValue({
						bind: vi.fn().mockReturnValue({
							all: vi.fn().mockResolvedValue({ results: [] })
						})
					})
				}
			}
		};

		const response = await GET({
			locals: { user: { id: 'user-123' } },
			platform: mockPlatform
		} as any);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.connections).toHaveLength(0);
	});
});

describe('Connected Accounts API - DELETE', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	it('should return 401 if user is not logged in', async () => {
		const { DELETE } = await import('../../src/routes/api/auth/connections/+server');

		await expect(
			DELETE({
				locals: {},
				platform: {},
				request: new Request('http://localhost', {
					method: 'DELETE',
					body: JSON.stringify({ provider: 'discord' })
				})
			} as any)
		).rejects.toMatchObject({ status: 401 });
	});

	it('should return 400 if provider is not specified', async () => {
		const { DELETE } = await import('../../src/routes/api/auth/connections/+server');

		await expect(
			DELETE({
				locals: { user: { id: 'user-123' } },
				platform: {},
				request: new Request('http://localhost', {
					method: 'DELETE',
					body: JSON.stringify({})
				})
			} as any)
		).rejects.toMatchObject({ status: 400 });
	});

	it('should not allow unlinking the only connection if user has no password', async () => {
		const { DELETE } = await import('../../src/routes/api/auth/connections/+server');

		const mockPlatform = {
			env: {
				DB: {
					prepare: vi.fn().mockImplementation((query: string) => ({
						bind: vi.fn().mockReturnValue({
							first: vi
								.fn()
								.mockResolvedValue(
									query.includes('password_hash') ? { password_hash: null } : null
								),
							all: vi.fn().mockResolvedValue({
								results: [{ provider: 'discord', provider_account_id: '12345' }]
							}),
							run: vi.fn().mockResolvedValue({})
						})
					}))
				}
			}
		};

		await expect(
			DELETE({
				locals: { user: { id: 'user-123' } },
				platform: mockPlatform,
				request: new Request('http://localhost', {
					method: 'DELETE',
					body: JSON.stringify({ provider: 'discord' })
				})
			} as any)
		).rejects.toMatchObject({ status: 400 });
	});

	it('should successfully unlink account when user has other connections', async () => {
		const { DELETE } = await import('../../src/routes/api/auth/connections/+server');

		const mockRunFn = vi.fn().mockResolvedValue({});
		const mockPlatform = {
			env: {
				DB: {
					prepare: vi.fn().mockImplementation((query: string) => ({
						bind: vi.fn().mockReturnValue({
							first: vi
								.fn()
								.mockResolvedValue(
									query.includes('password_hash') ? { password_hash: null } : null
								),
							all: vi.fn().mockResolvedValue({
								results: [
									{ provider: 'github', provider_account_id: '12345' },
									{ provider: 'discord', provider_account_id: '67890' }
								]
							}),
							run: mockRunFn
						})
					}))
				}
			}
		};

		const response = await DELETE({
			locals: { user: { id: 'user-123' } },
			platform: mockPlatform,
			request: new Request('http://localhost', {
				method: 'DELETE',
				body: JSON.stringify({ provider: 'discord' })
			})
		} as any);

		expect(response.status).toBe(200);
		expect(mockRunFn).toHaveBeenCalled();
	});

	it('should successfully unlink account when user has password', async () => {
		const { DELETE } = await import('../../src/routes/api/auth/connections/+server');

		const mockRunFn = vi.fn().mockResolvedValue({});
		const mockPlatform = {
			env: {
				DB: {
					prepare: vi.fn().mockImplementation((query: string) => ({
						bind: vi.fn().mockReturnValue({
							first: vi
								.fn()
								.mockResolvedValue(
									query.includes('password_hash') ? { password_hash: 'hashed_password' } : null
								),
							all: vi.fn().mockResolvedValue({
								results: [{ provider: 'discord', provider_account_id: '12345' }]
							}),
							run: mockRunFn
						})
					}))
				}
			}
		};

		const response = await DELETE({
			locals: { user: { id: 'user-123' } },
			platform: mockPlatform,
			request: new Request('http://localhost', {
				method: 'DELETE',
				body: JSON.stringify({ provider: 'discord' })
			})
		} as any);

		expect(response.status).toBe(200);
	});
});

describe('Profile Connected Accounts Display', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	it('should load connected accounts data for profile page', async () => {
		const { load } = await import('../../src/routes/profile/+page.server');

		const mockConnections = [
			{ provider: 'github', provider_account_id: '12345', created_at: '2024-01-01' },
			{ provider: 'discord', provider_account_id: '67890', created_at: '2024-01-02' }
		];

		const mockPlatform = {
			env: {
				DB: {
					prepare: vi.fn().mockReturnValue({
						bind: vi.fn().mockReturnValue({
							all: vi.fn().mockResolvedValue({ results: mockConnections })
						})
					})
				}
			}
		};

		const result = await load({
			locals: { user: { id: 'user-123', login: 'testuser', email: 'test@test.com' } },
			platform: mockPlatform
		} as any);

		expect(result).toBeDefined();
		expect((result as any).user).toBeDefined();
		expect((result as any).connectedAccounts).toHaveLength(2);
	});

	it('should return empty connected accounts when DB not available', async () => {
		const { load } = await import('../../src/routes/profile/+page.server');

		const result = await load({
			locals: { user: { id: 'user-123', login: 'testuser', email: 'test@test.com' } },
			platform: {}
		} as any);

		expect(result).toBeDefined();
		expect((result as any).user).toBeDefined();
		// No inference - DB is the source of truth
		expect((result as any).connectedAccounts).toEqual([]);
	});

	it('should return empty connected accounts for Discord user when DB not available', async () => {
		const { load } = await import('../../src/routes/profile/+page.server');

		const result = await load({
			locals: {
				user: { id: 'discord_987654321', login: 'discorduser', email: 'discord@test.com' }
			},
			platform: {}
		} as any);

		expect(result).toBeDefined();
		expect((result as any).user).toBeDefined();
		// No inference - DB is the source of truth
		expect((result as any).connectedAccounts).toEqual([]);
	});
});
