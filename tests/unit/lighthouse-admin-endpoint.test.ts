/**
 * The admin door into the audit. `/api/admin/lighthouse` takes a session
 * because its caller is a person; the scheduler's door (`/api/cron/lighthouse`,
 * a shared bearer secret) belongs to the scheduler port and must never accept
 * a browser session, nor this route a bearer secret.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { POST as adminPost } from '../../src/routes/api/admin/lighthouse/+server';

const sweep = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/lighthouse', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/server/lighthouse')>();
	return { ...actual, runLighthouseSweep: sweep };
});

beforeEach(() => {
	sweep.mockReset().mockResolvedValue({ audited: 3, failed: 0 });
});

function adminEvent(user: unknown, env: Record<string, unknown> = { DB: createSqliteD1() }) {
	return {
		request: { json: async () => ({}) },
		locals: { user },
		platform: { env }
	} as never;
}

describe('POST /api/admin/lighthouse', () => {
	it('runs for an admin', async () => {
		const response = await adminPost(
			adminEvent({ id: '1', isAdmin: true, permissions: ['lighthouse'] })
		);
		expect(response.status).toBe(200);
	});

	it('runs for the owner', async () => {
		const response = await adminPost(adminEvent({ id: '1', isOwner: true }));
		expect(response.status).toBe(200);
	});

	it('refuses a signed-in non-admin', async () => {
		// Guarded server-side, not by hiding the button. Hiding UI is not
		// authorization.
		await expect(adminPost(adminEvent({ id: '2' }))).rejects.toMatchObject({ status: 403 });
	});

	it('refuses an anonymous caller', async () => {
		await expect(adminPost(adminEvent(null))).rejects.toMatchObject({ status: 401 });
	});

	it('does not accept the cron secret in place of a session', async () => {
		// The two doors stay separate: no bearer token opens the admin one.
		await expect(
			adminPost(adminEvent(null, { DB: createSqliteD1(), CRON_SECRET: 's3cret' }))
		).rejects.toMatchObject({ status: 401 });
	});
});

describe('POST /api/admin/lighthouse (inputs)', () => {
	const admin = { id: '1', isOwner: true };

	it('answers 503 when there is no database', async () => {
		await expect(adminPost(adminEvent(admin, {}))).rejects.toMatchObject({ status: 503 });
		expect(sweep).not.toHaveBeenCalled();
	});

	it('passes a valid strategy and the optional PSI key through', async () => {
		const event = {
			request: { json: async () => ({ strategy: 'desktop' }) },
			locals: { user: admin },
			platform: { env: { DB: createSqliteD1(), PAGESPEED_API_KEY: 'k' } }
		} as never;
		await adminPost(event);
		expect(sweep.mock.calls[0][1]).toEqual({ strategy: 'desktop', apiKey: 'k' });
	});

	it('defaults to mobile when the body is not JSON', async () => {
		const event = {
			request: {
				json: async () => {
					throw new Error('bad body');
				}
			},
			locals: { user: admin },
			platform: { env: { DB: createSqliteD1() } }
		} as never;
		await adminPost(event);
		expect(sweep.mock.calls[0][1].strategy).toBe('mobile');
	});
});
